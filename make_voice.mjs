// お手本の声を前もって作って、音声ファイルとして保存する（端末の読み上げにたよらない）。
// AI（Live API）に読ませる → 別のAIに聞き取らせて、読みのまちがい・余計な発言・不自然さがないか確かめる
// → 合格した声だけ mp3 にして voice/ に保存し、voice.js（文 → ファイル）に登録する。不合格はやり直す（最大3回）。
// 使い方: node make_voice.mjs words      単語（vocab.js の word）
//         node make_voice.mjs examples   単語の例文
//         node make_voice.mjs words 50   先頭から50件だけ（ためし）
// できているファイルはとばすので、途中で止まっても続きから動かせる。記録は qa/voice_log.json
import fs from "fs";
import { execFileSync } from "child_process";
import { createHash } from "crypto";
import { VOCAB } from "./vocab.js";
import { RUBY } from "./ruby.js";
import { speechOf } from "./yomi.js";

const KEY = process.env.GEMINI_API_KEY || (fs.existsSync(".devkey") ? fs.readFileSync(".devkey", "utf8").trim() : "");
if (!KEY) { console.error("APIキーがありません"); process.exit(1); }
const LIVE_MODEL = "gemini-3.8-live";
// 判定のAI（かしこい方だけを使う。混んでいるときは待ってやり直す）
const JUDGE = "gemini-3.5-flash";
// REDO=1 … 合格ずみの声も、JUDGE で点検していないものは点検し直す
const REDO = !!process.env.REDO;
const MAXTRY = 5;
const WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const VOICE_NAME = "Kore";   // 全部の声を同じ人にそろえる
const joinJa = s => s.replace(/(?<=[^\x00-\x7F])[ 　]+(?=[^\x00-\x7F])/g, "");
const hira = s => String(s).replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const norm = s => hira(s).replace(/[^ぁ-んー]/g, "").replace(/ー/g, "");
const sleep = ms => new Promise(r => setTimeout(r, ms));

function liveSpeak(text, style, reading) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(KEY)}`);
    const chunks = []; let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; ws.close(); reject(new Error("timeout")); } }, 40000);
    ws.onopen = () => ws.send(JSON.stringify({ setup: {
      model: `models/${LIVE_MODEL}`,
      systemInstruction: { parts: [{ text:
        "あなたは日本語の読み上げ係です。ユーザーから届く日本語のせりふを、一字一句そのまま、指定された話し方で声に出して読みます。" +
        "せりふ以外のこと（あいさつ・説明・感想・返事）は一切言いません。せりふを変えたり足したりしません。" +
        "「読み方」が付いているときは、せりふの漢字・数字・英字を、その読み方のとおりの音で読みます（読み方を2回読んだり、別に読み上げたりはしません）。" +
        "標準語の自然なアクセントで読みます。かっこ・記号の名前は読まず、区切りとして少し間をあけます。" }] },
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } } },
    } }));
    ws.onmessage = async e => {
      const msg = JSON.parse(typeof e.data === "string" ? e.data : Buffer.from(await e.data.arrayBuffer()).toString());
      if (msg.setupComplete) {
        ws.send(JSON.stringify({ realtimeInput: { text: `話し方：${style}\n読み方：${reading}\nせりふ：${text}` } }));
        return;
      }
      const c = msg.serverContent;
      for (const p of c?.modelTurn?.parts || []) if (p.inlineData?.data) chunks.push(Buffer.from(p.inlineData.data, "base64"));
      if (c?.turnComplete && !done) { done = true; clearTimeout(timer); ws.close(); resolve(Buffer.concat(chunks)); }
    };
    ws.onclose = e => { if (!done) { done = true; clearTimeout(timer); reject(new Error(`closed ${e.code} ${e.reason}`)); } };
    ws.onerror = () => {};
  });
}

function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function judge(wavBuf, text, kana) {
  const prompt = `この音声は、日本語学習アプリのお手本の声です。次のことばを読んでいるはずです。
ことば：${text}
正しい読み方：${kana}
音声を注意深く聞いて判定してください。
- transcript: 聞こえたとおりをひらがなで（漢字を使わない）
- reading_ok: 正しい読み方のとおりに読んでいるか（読みちがい・抜け・言い直しがあれば false）
- extra_speech: ことば以外にしゃべったこと（説明・あいさつなど）。なければ空文字
- accent_ok: 日本人が聞いて、標準語のアクセント・イントネーションが自然か
- naturalness: 自然さ（1=とても不自然〜5=とても自然）
- comment: 気になる点を短く`;
  const schema = { type: "OBJECT", properties: {
    transcript: { type: "STRING" }, reading_ok: { type: "BOOLEAN" }, extra_speech: { type: "STRING" },
    accent_ok: { type: "BOOLEAN" }, naturalness: { type: "INTEGER" }, comment: { type: "STRING" },
  }, required: ["transcript", "reading_ok", "extra_speech", "accent_ok", "naturalness", "comment"] };
  let res;
  for (let w = 0; ; w++) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${JUDGE}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: wavBuf.toString("base64") } }, { text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 },
      }),
    });
    if ((res.status === 503 || res.status === 500) && w < 20) { await sleep(5000 + w * 3000); continue; }   // 混雑
    break;
  }
  if (!res.ok) {
    const t = await res.text();
    if (/FreeTier/.test(t)) { save(); console.log("無料の枠の上限です（課金が効いていません）。止めます"); process.exit(3); }
    throw new Error(`judge ${res.status} ${t.slice(0, 200)}`);
  }
  const d = await res.json();
  return JSON.parse(d.candidates[0].content.parts.map(p => p.text).join(""));
}

// 前後の無音を切って、小さい mp3 にする（スマホでも iPhone でも鳴る形式）
function toMp3(pcm, out) {
  const tmp = out + ".wav";
  fs.writeFileSync(tmp, wav(pcm));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp,
    "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse",
    "-ac", "1", "-ar", "24000", "-b:a", "40k", out]);
  fs.unlinkSync(tmp);
}

const kind = process.argv[2] || "words";
const limit = +process.argv[3] || Infinity;
const items = [];
for (const v of VOCAB) {
  if (process.env.LEVEL && !String(v.id).startsWith(process.env.LEVEL)) continue;   // 例: LEVEL=n5
  if (kind === "words") items.push({ text: v.word, kana: hira(v.reading), style: "単語を一つだけ、辞書の発音見本のように、標準語の正しいアクセントで、はっきり自然に" });
  else for (const e of v.ex) { const sp = speechOf(e.ja, "", RUBY); items.push({ text: e.ja, kana: sp.kana, say: sp.text, style: "日本語の先生が、標準語の自然なアクセントで、はっきり、少しゆっくり" }); }
}
const id = t => createHash("sha1").update(t).digest("hex").slice(0, 12);
fs.mkdirSync("voice", { recursive: true });
fs.mkdirSync("qa/pending", { recursive: true });
const MAN = "voice_list.json";   // 文 → ファイル名（あとで voice.js にする）
const man = fs.existsSync(MAN) ? JSON.parse(fs.readFileSync(MAN, "utf8")) : {};
const logPath = "qa/voice_log.json";
const log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")) : {};
const done = it => REDO ? (log[it.text]?.ok && log[it.text].model === JUDGE) : !!man[it.text];
const todo = items.filter(it => !done(it)).slice(0, limit);
console.log(`${kind}: 全${items.length}件 / できている${items.length - items.filter(it => !done(it)).length}件 / 今回${todo.length}件`);

let ok = 0, ng = 0, quota = 0, gen = 0;
async function work(it) {
  const say = joinJa(it.say || it.text), kana = joinJa(it.kana);
  for (let tryN = 1; tryN <= MAXTRY; tryN++) {
    try {
      const pend = `qa/pending/${id(it.text)}-${tryN}.pcm`;
      const pcm = fs.existsSync(pend) ? fs.readFileSync(pend) : await liveSpeak(say, it.style, kana);
      fs.writeFileSync(pend, pcm);
      if (process.env.GENONLY) { gen++; return; }   // 声だけ先に作っておく（判定はあとで。判定AIの1日の上限のため）
      const sec = pcm.length / 2 / 24000;
      if (sec < 0.3 || sec > Math.max(4, kana.length * 0.5)) throw new Error(`長さがおかしい ${sec.toFixed(1)}秒`);
      const j = await judge(wav(pcm), it.text, kana);
      const readOk = j.reading_ok && norm(j.transcript) === norm(kana);
      quota = 0;
      if (readOk && !j.extra_speech && j.accent_ok && j.naturalness >= 4) {
        const f = id(it.text) + ".mp3";
        toMp3(pcm, `voice/${f}`);
        man[it.text] = f; ok++;
        log[it.text] = { ok: true, tries: tryN, naturalness: j.naturalness, model: JUDGE };
        return;
      }
      log[it.text] = { ok: false, model: JUDGE, tries: tryN, transcript: j.transcript, readOk, accent: j.accent_ok, nat: j.naturalness, extra: j.extra_speech, comment: j.comment };
    } catch (e) {
      log[it.text] = { ok: false, tries: tryN, error: String(e.message).slice(0, 200) };
      if (/429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|quota/i.test(e.message)) { console.log("利用上限:", e.message.slice(0, 80)); quota++; if (quota > 300) { save(); console.log("利用上限が続くので止めます"); process.exit(2); } await sleep(60000); tryN--; }
    }
  }
  if (REDO) delete man[it.text];   // かしこいAIで不合格 → お手本の声から外す（端末の声にもどる）
  ng++;
}
const CONC = +process.env.CONC || 3;
let i = 0, n = 0;
const save = () => { fs.writeFileSync(MAN, JSON.stringify(man)); fs.writeFileSync(logPath, JSON.stringify(log, null, 1)); };
await Promise.all(Array.from({ length: CONC }, async () => {
  while (i < todo.length) {
    const it = todo[i++];
    await work(it);
    if (++n % 10 === 0) { save(); console.log(`${n}/${todo.length} 合格${ok} 不合格${ng} 声だけ${gen}`); }
  }
}));
save();
fs.writeFileSync("voice.js", "// 前もって作ったお手本の声（make_voice.mjs で作る）。文 → voice/ のファイル名\nexport const VOICE = " + JSON.stringify(man) + ";\n");
console.log(`おわり: 合格${ok} 不合格${ng}（不合格は qa/voice_log.json）`);
