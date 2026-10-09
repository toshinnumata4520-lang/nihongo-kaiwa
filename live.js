// AIとの声の会話（Gemini Live API）。同時通訳アプリの live.js を元に、1つの接続で会話する形にしたもの。
// 1場面は最長5分。会話が長いほど毎ターンの料金が増えるため（会話全体を数え直す）、5分で区切る。

const WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
export const LIVE_MODEL = "gemini-3.8-live";

const WORKLET = `registerProcessor("tap", class extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
});`;

let state = null;

// onText(who, text, done)  who = "me" | "ai"
// onUsage(usageMetadata)    サーバーが返す使用量（原価の実測に使う）
// onTurn(state)             "wait"=AIが話し始めるのを待つ / "ai"=AIが話している / "you"=学習者の番 / "hearing"=学習者の声を聞き取り中
// onLevel(0〜1)             マイクの音の大きさ（声を拾えているかの表示用）
export async function startConversation({ key, systemText, openingText, onText, onStatus, onUsage, onClose, onTurn, onLevel }) {
  stopConversation();
  // iPhone はタップ操作の中で AudioContext を作らないと音が出ないので、await より前に作る
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const st = state = { ctx, onText, onStatus, onUsage, onClose, onTurn: onTurn || (() => {}), onLevel: onLevel || (() => {}),
    ws: null, ready: false, stream: null, node: null, aiSpeaking: false, turnDone: true,
    pending: [], pendingLen: 0, playAt: 0, stopped: false, sources: [], startedAt: Date.now() };
  try {
    st.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    onStatus("mic-denied", true);
    stopConversation();
    return false;
  }
  await ctx.resume();
  const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const src = ctx.createMediaStreamSource(st.stream);
  st.node = new AudioWorkletNode(ctx, "tap");
  st.node.port.onmessage = e => onMic(st, e.data);
  src.connect(st.node);
  const mute = ctx.createGain(); mute.gain.value = 0;   // 無音で出力に繋がないと Safari が処理を止めることがある
  st.node.connect(mute).connect(ctx.destination);

  const ws = st.ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(key)}`);
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
  ws.onmessage = async e => {
    const msg = JSON.parse(typeof e.data === "string" ? e.data : await e.data.text());
    if (msg.usageMetadata) st.onUsage?.(msg.usageMetadata);
    if (msg.setupComplete) {
      st.ready = true;
      onStatus("listening");
      st.onTurn("wait");
      // AIから話し始めてもらう（最初の一言は場面データで決める）
      if (openingText) ws.send(JSON.stringify({ realtimeInput: { text: openingText } }));
      return;
    }
    if (msg.goAway) { onStatus("time-up"); return; }
    const c = msg.serverContent;
    if (!c) return;
    if (c.interrupted) { stopPlayback(st); st.aiSpeaking = false; st.turnDone = true; st.onTurn("hearing"); }   // 学習者が話し始めたら、AIの声を止める
    if (c.inputTranscription?.text) { st.onText("me", c.inputTranscription.text, false); if (!st.aiSpeaking) st.onTurn("hearing"); }
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
    if (!st.stopped && state === st) { onStatus("closed", e.code !== 1000, `${e.code} ${e.reason || ""}`); st.onClose?.(); }
  };
  return true;
}

// せりふの読み上げ：会話と同じ Live API に、文を一字一句そのまま読ませて、声（24kHz・16bit PCM）だけを受け取る。
// 会話で使えている仕組みなので、TTS専用の窓口より確実。話し方（早口・関西弁など）と読み方も指示する
export function liveSpeak(key, text, { style = "", reading = "", voice = "" } = {}) {
  const attempt = withVoice => new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(key)}`);
    const chunks = []; let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; try { ws.close(1000); } catch {} reject(new Error("timeout")); } }, 20000);
    ws.onopen = () => ws.send(JSON.stringify({ setup: {
      model: `models/${LIVE_MODEL}`,
      systemInstruction: { parts: [{ text:
        "あなたは日本語の読み上げ係です。ユーザーから届く日本語のせりふを、一字一句そのまま、指定された話し方で声に出して読みます。" +
        "せりふ以外のこと（あいさつ・説明・感想・返事）は一切言いません。せりふを変えたり足したりしません。" } ] },
      generationConfig: { responseModalities: ["AUDIO"],
        ...(withVoice && voice ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } : {}) },
    } }));
    ws.onmessage = async e => {
      const msg = JSON.parse(typeof e.data === "string" ? e.data : await e.data.text());
      if (msg.setupComplete) {
        ws.send(JSON.stringify({ realtimeInput: { text:
          `話し方：${style || "自然に"}\n${reading ? `読み方：${reading}\n` : ""}せりふ：${text}` } }));
        return;
      }
      const c = msg.serverContent;
      for (const p of c?.modelTurn?.parts || []) if (p.inlineData?.data) chunks.push(p.inlineData.data);
      if (c?.turnComplete && !done) {
        done = true; clearTimeout(timer); try { ws.close(1000); } catch {}
        let total = 0; const parts = chunks.map(b => { const s = atob(b); total += s.length; return s; });
        const bytes = new Uint8Array(total); let o = 0;
        for (const s of parts) { for (let i = 0; i < s.length; i++) bytes[o++] = s.charCodeAt(i); }
        bytes.length ? resolve({ bytes, rate: 24000, isWav: false }) : reject(new Error("no audio"));
      }
    };
    ws.onclose = e => { if (!done) { done = true; clearTimeout(timer); reject(new Error(`closed ${e.code} ${e.reason || ""}`)); } };
  });
  // 声の指定が受け付けられないときは、指定なしでやり直す
  return attempt(true).catch(err => voice ? attempt(false) : Promise.reject(err));
}

// 学習者のボタン操作（ヒント・ゆっくり）を、AIへの指示として送る
export function sendNote(text) {
  const st = state;
  if (st?.ready && st.ws.readyState === 1) st.ws.send(JSON.stringify({ realtimeInput: { text } }));
}

export function stopConversation() {
  const st = state; state = null;
  if (!st) return 0;
  st.stopped = true;
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
  st.onLevel(muted ? 0 : Math.min(1, Math.sqrt(sum / all.length) * 8));
  if (muted || !st.ready || st.ws.readyState !== 1) return;
  const outLen = Math.floor(all.length * 16000 / rate);
  const pcm = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = Math.max(-1, Math.min(1, all[Math.floor(i * rate / 16000)]));
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
  if (!st.aiSpeaking) { st.aiSpeaking = true; st.onTurn("ai"); }
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
  setTimeout(() => { if (!st.stopped && !st.aiSpeaking) st.onTurn("you"); }, 400);
}
