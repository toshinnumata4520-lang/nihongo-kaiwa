// 音声の自動チェック：アプリと同じ仕組み（Live API）で読み上げた声を保存し、別のAIに聞き取らせて
// 読み間違い・余計な発言・抜け・自然さを判定する。結果は qa/ に保存（GitHubには上げない）。
// 使い方: node audio_check.mjs        （環境変数 GEMINI_API_KEY または .devkey のキーを使う）
//         node audio_check.mjs f1 c2  （IDを指定するとその問題だけ）
import fs from "fs";
import { DRILLS } from "./drills.js";

const KEY = process.env.GEMINI_API_KEY || (fs.existsSync(".devkey") ? fs.readFileSync(".devkey", "utf8").trim() : "");
if (!KEY) { console.error("APIキーがありません"); process.exit(1); }
const LIVE_MODEL = "gemini-3.8-live";
const JUDGE_MODEL = "gemini-3.5-flash";
const WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

// app.js と同じ話し方の指示
const STYLE_PROMPT = {
  "早口": "職場で忙しくしている人が、少し早口で自然に言う",
  "関西弁": "関西の人が、関西弁のイントネーションで自然に言う",
  "方言": "地方のおばあさんが、方言まじりにゆっくり言う",
  "略語": "忙しい飲食店の店長が、早口でぶっきらぼうに言う",
  "あいまい": "忙しそうな人が、軽い口調でさらっと言う",
  "電話": "電話の向こうのお客様が、ていねいに言う",
  "現場のことば": "建設現場の職長が、大きな声ではっきり言う",
};

// live.js の liveSpeak と同じ手順
function liveSpeak(text, { style = "", reading = "", voice = "" } = {}, withVoice = true) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?key=${encodeURIComponent(KEY)}`);
    const chunks = []; let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; ws.close(); reject(new Error("timeout")); } }, 30000);
    ws.onopen = () => ws.send(JSON.stringify({ setup: {
      model: `models/${LIVE_MODEL}`,
      systemInstruction: { parts: [{ text:
        "あなたは日本語の読み上げ係です。ユーザーから届く日本語のせりふを、一字一句そのまま、指定された話し方で声に出して読みます。" +
        "せりふ以外のこと（あいさつ・説明・感想・返事）は一切言いません。せりふを変えたり足したりしません。" }] },
      generationConfig: { responseModalities: ["AUDIO"],
        ...(withVoice && voice ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } : {}) },
    } }));
    ws.onmessage = async e => {
      const msg = JSON.parse(typeof e.data === "string" ? e.data : Buffer.from(await e.data.arrayBuffer()).toString());
      if (msg.setupComplete) {
        ws.send(JSON.stringify({ realtimeInput: { text: `話し方：${style || "自然に"}\n${reading ? `読み方：${reading}\n` : ""}せりふ：${text}` } }));
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

async function judge(wavBuf, expected, reading, style) {
  const prompt = `この音声は、日本語学習アプリが「${style}」という話し方で次のせりふを読み上げたものです。
せりふ：${expected}
正しい読み方：${reading}
音声を注意深く聞いて、次を判定してください。
- transcript: 聞こえたとおりの文字起こし（ひらがな・カタカナで、読み方が分かるように）
- reading_errors: 正しい読み方と違う読み方をした言葉（例：薬→やく）。なければ空
- extra_speech: せりふ以外にしゃべったこと（説明・あいさつ・指示の読み上げなど）。なければ空
- missing: 抜けた言葉。なければ空
- naturalness: 日本人が聞いて自然か（1=とても不自然〜5=とても自然）
- style_match: 指定の話し方（${style}）になっているか（1〜5）
- comment: 気になる点を短く（日本語）`;
  const schema = { type: "OBJECT", properties: {
    transcript: { type: "STRING" }, reading_errors: { type: "ARRAY", items: { type: "STRING" } },
    extra_speech: { type: "STRING" }, missing: { type: "ARRAY", items: { type: "STRING" } },
    naturalness: { type: "INTEGER" }, style_match: { type: "INTEGER" }, comment: { type: "STRING" },
  }, required: ["transcript", "reading_errors", "extra_speech", "missing", "naturalness", "style_match", "comment"] };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: wavBuf.toString("base64") } }, { text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 },
    }),
  });
  if (!res.ok) throw new Error(`judge ${res.status} ${(await res.text()).slice(0, 300)}`);
  const d = await res.json();
  return JSON.parse(d.candidates[0].content.parts.map(p => p.text).join(""));
}

const only = process.argv.slice(2);
const items = DRILLS.filter(d => !only.length || only.includes(d.id));
fs.mkdirSync("qa/audio", { recursive: true });
const results = [];
for (const d of items) {
  const style = STYLE_PROMPT[d.style];
  process.stdout.write(`${d.id} ${d.say} … `);
  try {
    let pcm;
    try { pcm = await liveSpeak(d.say, { style, reading: d.say_kana, voice: d.voice }, true); }
    catch (e) { console.log(`(声の指定なしで再試行: ${e.message}) `); pcm = await liveSpeak(d.say, { style, reading: d.say_kana, voice: d.voice }, false); }
    const w = wav(pcm); fs.writeFileSync(`qa/audio/${d.id}.wav`, w);
    const j = await judge(w, d.say, d.say_kana, d.style);
    const sec = (pcm.length / 2 / 24000).toFixed(1);
    results.push({ id: d.id, say: d.say, style: d.style, voice: d.voice, sec, ...j });
    console.log(`自然さ${j.naturalness} 話し方${j.style_match} 読み誤り${j.reading_errors.length} 余計${j.extra_speech ? "あり" : "なし"} 抜け${j.missing.length} ${sec}秒`);
  } catch (e) {
    results.push({ id: d.id, say: d.say, error: String(e.message) });
    console.log("エラー", e.message);
  }
}
fs.writeFileSync("qa/audio_report.json", JSON.stringify(results, null, 2));
const md = ["| ID | 話し方 | 自然さ | 話し方 | 読み誤り | 余計な発言 | 抜け | 聞こえた音 | コメント |", "|---|---|---|---|---|---|---|---|---|",
  ...results.map(r => r.error ? `| ${r.id} | | | | | | | エラー: ${r.error} | |`
    : `| ${r.id} | ${r.style} | ${r.naturalness} | ${r.style_match} | ${r.reading_errors.join("、")} | ${r.extra_speech} | ${r.missing.join("、")} | ${r.transcript} | ${r.comment} |`)].join("\n");
fs.writeFileSync("qa/audio_report.md", md);
console.log("\nqa/audio_report.md に保存しました");
