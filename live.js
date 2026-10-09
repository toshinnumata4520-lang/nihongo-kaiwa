// AIとの声の会話（Gemini Live API）。同時通訳アプリの live.js を元に、1つの接続で会話する形にしたもの。
// 1場面は最長5分。会話が長いほど毎ターンの料金が増えるため（会話全体を数え直す）、5分で区切る。

const WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
export const LIVE_MODEL = "gemini-3.8-live";

const WORKLET = `registerProcessor("tap", class extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
});`;

let state = null;
const dec = new TextDecoder();
const parse = d => JSON.parse(typeof d === "string" ? d : dec.decode(d));   // 届いた順に同期で処理する（await すると順番が入れ替わることがある）

// onText(who, text, done)  who = "me" | "ai"
// onUsage(usageMetadata)    サーバーが返す使用量（原価の実測に使う）
// onTurn(state)             "wait"=AIが話し始めるのを待つ / "ai"=AIが話している / "you"=学習者の番 / "hearing"=学習者の声を聞き取り中
// onLevel(0〜1)             マイクの音の大きさ（声を拾えているかの表示用）
// onClose(err)              接続が切れた。err はエラーのとき理由の文字、ふつうに閉じたときは null
// 起動中の失敗は例外で返す（呼び出し側でエラー表示）。マイクが使えないときは false
export async function startConversation({ key, systemText, openingText, onText, onStatus, onUsage, onClose, onTurn, onLevel }) {
  stopConversation();
  // iPhone はタップ操作の中で AudioContext を作らないと音が出ないので、await より前に作る
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const st = state = { ctx, onText, onStatus, onUsage, onClose, onTurn: onTurn || (() => {}), onLevel: onLevel || (() => {}),
    ws: null, ready: false, stream: null, node: null, aiSpeaking: false, turnDone: true, turn: "wait",
    pending: [], pendingLen: 0, playAt: 0, stopped: false, sources: [], startedAt: Date.now(), quietMs: 0, flushed: false };
  st.setTurn = s => { st.turn = s; st.onTurn(s); };
  // 起動の途中で「おわる」や画面の切り替えがあったら、開いたマイクを閉じて終わる
  const aborted = () => { if (!st.stopped) return false; st.stream?.getTracks().forEach(t => t.stop()); return true; };
  try {
    st.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    if (aborted()) return false;
    onStatus("mic-denied", true, e?.name || "");
    stopConversation();
    return false;
  }
  if (aborted()) return false;
  try {
    await ctx.resume(); if (aborted()) return false;
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    if (aborted()) return false;
    const src = ctx.createMediaStreamSource(st.stream);
    st.node = new AudioWorkletNode(ctx, "tap");
    st.node.port.onmessage = e => onMic(st, e.data);
    src.connect(st.node);
    const mute = ctx.createGain(); mute.gain.value = 0;   // 無音で出力に繋がないと Safari が処理を止めることがある
    st.node.connect(mute).connect(ctx.destination);
  } catch (e) {
    if (state === st) stopConversation(); else st.stream?.getTracks().forEach(t => t.stop());
    throw e;
  }

  const ws = st.ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(key)}`);
  ws.binaryType = "arraybuffer";
  ws.onopen = () => ws.send(JSON.stringify({ setup: {
    model: `models/${LIVE_MODEL}`,
    systemInstruction: { parts: [{ text: systemText }] },
    // 文字起こしの指定は generationConfig の中ではなく setup の直下（同時通訳アプリで確認済み）
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    generationConfig: { responseModalities: ["AUDIO"] },
    // 話し始めの判定だけ鈍くする（雑音で反応しないように）。話し終わりの判定は標準のまま（遅くすると返事が遅れる）
    realtimeInputConfig: { automaticActivityDetection: { startOfSpeechSensitivity: "START_SENSITIVITY_LOW" } },
  } }));
  ws.onmessage = e => {
    if (st.stopped) return;
    let msg; try { msg = parse(e.data); } catch { return; }
    if (msg.usageMetadata) st.onUsage?.(msg.usageMetadata);
    if (msg.setupComplete) {
      st.ready = true;
      onStatus("listening");
      st.setTurn("wait");
      // AIから話し始めてもらう（最初の一言は場面データで決める）
      if (openingText) ws.send(JSON.stringify({ realtimeInput: { text: openingText } }));
      // AIが話し始めないときは、6秒で学習者の番にする（「まってください」のまま止まらないように）
      st.waitTimer = setTimeout(() => { if (!st.stopped && !st.aiSpeaking && !st.sources.length && st.turn === "wait") yourTurn(st); }, 6000);
      return;
    }
    if (msg.goAway) { onStatus("time-up"); return; }
    const c = msg.serverContent;
    if (!c) return;
    if (c.interrupted) {   // 学習者が話し始めたら、AIの声を止める
      stopPlayback(st); st.aiSpeaking = false; st.turnDone = true;
      st.onText("ai", "", true); st.setTurn("hearing");
    }
    if (c.inputTranscription?.text) st.onText("me", c.inputTranscription.text, false);
    if (c.outputTranscription?.text) st.onText("ai", c.outputTranscription.text, false);
    for (const p of c.modelTurn?.parts || []) if (p.inlineData?.data) { st.turnDone = false; play(st, p.inlineData.data); }
    if (c.turnComplete) {
      st.onText("ai", "", true);
      st.turnDone = true;
      if (!st.sources.length) yourTurn(st);   // 声を流し終わっていれば、学習者の番
    }
  };
  ws.onclose = e => {
    st.ready = false;
    if (!st.stopped && state === st) {
      const err = e.code !== 1000 ? `${e.code} ${e.reason || ""}`.trim() : null;
      onStatus("closed", !!err, err || "");
      st.onClose?.(err);
    }
  };
  return true;
}

// せりふの読み上げ：会話と同じ Live API に、文を一字一句そのまま読ませて、声（24kHz・16bit PCM）だけを受け取る。
// 会話で使えている仕組みなので、TTS専用の窓口より確実。話し方（早口・関西弁など）と読み方も指示する。
// signal（AbortSignal）で、画面が変わったときに途中で止められる
export function liveSpeak(key, text, { style = "", reading = "", voice = "", signal } = {}) {
  const attempt = withVoice => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("aborted", "AbortError")); return; }
    const ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(key)}`);
    ws.binaryType = "arraybuffer";
    const chunks = []; let done = false, setupOk = false;
    const fail = err => { if (done) return; done = true; clearTimeout(timer); try { ws.close(1000); } catch {} reject(err); };
    const timer = setTimeout(() => fail(new Error("timeout")), 15000);
    signal?.addEventListener("abort", () => fail(new DOMException("aborted", "AbortError")), { once: true });
    ws.onopen = () => ws.send(JSON.stringify({ setup: {
      model: `models/${LIVE_MODEL}`,
      systemInstruction: { parts: [{ text:
        "あなたは日本語の読み上げ係です。ユーザーから届く日本語のせりふを、一字一句そのまま、指定された話し方で声に出して読みます。" +
        "せりふ以外のこと（あいさつ・説明・感想・返事）は一切言いません。せりふを変えたり足したりしません。" } ] },
      generationConfig: { responseModalities: ["AUDIO"],
        ...(withVoice && voice ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } : {}) },
    } }));
    ws.onmessage = e => {
      if (done) return;
      let msg; try { msg = parse(e.data); } catch { return; }
      if (msg.setupComplete) {
        setupOk = true;
        ws.send(JSON.stringify({ realtimeInput: { text:
          `話し方：${style || "自然に"}\n${reading ? `読み方：${reading}\n` : ""}せりふ：${text}` } }));
        return;
      }
      const c = msg.serverContent;
      for (const p of c?.modelTurn?.parts || []) if (p.inlineData?.data) chunks.push(p.inlineData.data);
      if (c?.turnComplete) {
        done = true; clearTimeout(timer); try { ws.close(1000); } catch {}
        let total = 0; const parts = chunks.map(b => { const s = atob(b); total += s.length; return s; });
        const bytes = new Uint8Array(total); let o = 0;
        for (const s of parts) { for (let i = 0; i < s.length; i++) bytes[o++] = s.charCodeAt(i); }
        bytes.length ? resolve({ bytes, rate: 24000, isWav: false }) : reject(new Error("no audio"));
      }
    };
    ws.onclose = e => { const er = new Error(`closed ${e.code} ${e.reason || ""}`); er.setupFailed = !setupOk; fail(er); };
  });
  // 声の指定が受け付けられないとき（つないですぐ断られたとき）だけ、指定なしでやり直す
  return attempt(true).catch(err => voice && err.setupFailed ? attempt(false) : Promise.reject(err));
}

// 会話中にアプリが別の音（お手本の🔊など）を鳴らす間、その音をマイクが拾って学習者の発言と誤解されないよう、マイクを止める
export function muteFor(ms) { if (state) state.muteUntil = Math.max(state.muteUntil || 0, Date.now() + ms); }

// 学習者のボタン操作（ヒント・ゆっくり）を、AIへの指示として送る
// 送れたら true（つながっていないときは false）
export function sendNote(text) {
  const st = state;
  if (st?.ready && st.ws.readyState === 1) { st.ws.send(JSON.stringify({ realtimeInput: { text } })); return true; }
  return false;
}

export function stopConversation() {
  const st = state; state = null;
  if (!st) return 0;
  st.stopped = true;
  clearTimeout(st.waitTimer);
  stopPlayback(st);
  try { st.ws?.close(1000); } catch {}   // 正しく閉じないと、古い接続が残って次の接続が断られることがある
  st.stream?.getTracks().forEach(t => t.stop());
  try { st.node?.disconnect(); } catch {}
  st.ctx.close().catch(() => {});
  return (Date.now() - st.startedAt) / 1000;
}

// マイク音声を 16kHz・16bit PCM に変換し、約100msごとに送る
function onMic(st, f32) {
  st.pending.push(f32); st.pendingLen += f32.length;
  const rate = st.ctx.sampleRate;
  if (st.pendingLen < rate / 10) return;
  const all = new Float32Array(st.pendingLen);
  let o = 0; for (const p of st.pending) { all.set(p, o); o += p.length; }
  st.pending = []; st.pendingLen = 0;
  let sum = 0; for (let i = 0; i < all.length; i++) sum += all[i] * all[i];
  // AIが話している間（と話し終わってすぐ）は、マイクの音を送らない。
  // スピーカーから出たAIの声をマイクが拾って「学習者が話した」と誤判定され、AIが止まるのを防ぐ
  const muted = st.aiSpeaking || Date.now() < (st.muteUntil || 0);
  const level = muted ? 0 : Math.min(1, Math.sqrt(sum / all.length) * 8);
  st.onLevel(level);
  if (muted || !st.ready || st.ws.readyState !== 1) return;
  // 「聞いています」は、学習者の番に本当に声が出たときだけにする（前の発言の文字起こしが遅れて届いても変えない）
  const ms = all.length / rate * 1000;
  if (level > 0.15) { st.quietMs = 0; if (st.turn === "you" || st.turn === "wait") { st.flushed = false; st.setTurn("hearing"); } }
  else st.quietMs += ms;
  // 話し終わって2秒たってもAIが返事を始めないときは、「話し終わった」と知らせる（「聞いています」のまま長く待たないように）
  if (st.turn === "hearing" && !st.flushed && st.quietMs > 2000) {
    st.flushed = true;
    st.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
  }
  const outLen = Math.floor(all.length * 16000 / rate);
  const pcm = new Int16Array(outLen);
  const step = rate / 16000;
  for (let i = 0; i < outLen; i++) {
    // 間引くだけだと音がひずむので、区間の平均を取る
    const a = Math.floor(i * step), b = Math.max(a + 1, Math.floor((i + 1) * step));
    let acc = 0; for (let j = a; j < b; j++) acc += all[j] || 0;
    const s = Math.max(-1, Math.min(1, acc / (b - a)));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  st.ws.send(JSON.stringify({ realtimeInput: { audio: { data: toBase64(new Uint8Array(pcm.buffer)), mimeType: "audio/pcm;rate=16000" } } }));
}

function toBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// AIの声（24kHz・16bit PCM）を途切れないよう順番に再生する
function play(st, b64) {
  const bin = atob(b64), n = bin.length >> 1;
  const buf = st.ctx.createBuffer(1, n, 24000), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    ch[i] = v / 0x8000;
  }
  const node = st.ctx.createBufferSource(); node.buffer = buf; node.connect(st.ctx.destination);
  st.playAt = Math.max(st.playAt, st.ctx.currentTime + 0.02);
  node.start(st.playAt);
  st.playAt += buf.duration;
  st.sources.push(node);
  clearTimeout(st.waitTimer);
  if (!st.aiSpeaking) { st.aiSpeaking = true; st.setTurn("ai"); }
  node.onended = () => {
    st.sources = st.sources.filter(s => s !== node);
    // AIの発言が終わり、声も流し終わったら、学習者の番
    if (!st.sources.length && st.turnDone && st.aiSpeaking) yourTurn(st);
  };
}

function stopPlayback(st) {
  for (const s of st.sources) try { s.stop(); } catch {}
  st.sources = []; st.playAt = 0;
}

// AIが話し終わったら、部屋に残る声（反響）が消えるのを少し待ってから、学習者の番にしてマイクを開く
function yourTurn(st) {
  st.aiSpeaking = false;
  st.muteUntil = Date.now() + 400;
  st.quietMs = 0; st.flushed = false;
  setTimeout(() => { if (!st.stopped && !st.aiSpeaking) st.setTurn("you"); }, 400);
}
