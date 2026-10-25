// 単語のお手本の声を、Google の読み上げ専用サービス（Neural2-B）で作る。
// 読みまちがい（例：雨を「う」）を防ぐため、作った声をかしこいAIに聞き取らせ、読みが辞書どおりか確かめる。
// ちがっていたら、読み方を指定して作り直す（SSML の sub → ひらがな の順）。
// 使い方: LEVEL=n5 node make_voice_tts.mjs   （キー: GOOGLE_TTS_KEY と GEMINI_API_KEY）
import fs from "fs";
import { execFileSync } from "child_process";
import { createHash } from "crypto";
import { VOCAB } from "./vocab.js";

const env = n => process.env[n] || execFileSync("powershell", ["-NoProfile", "-Command", `[Environment]::GetEnvironmentVariable('${n}','User')`]).toString().trim();
const TTS_KEY = env("GOOGLE_TTS_KEY"), GEM_KEY = env("GEMINI_API_KEY");
const VOICE = "ja-JP-Neural2-B", JUDGE = "gemini-3.5-flash";
const hira = s => String(s).replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
// 長音のちがいは同じとみなす（おーい＝おおい、ゆう＝いう、せんせい＝せんせー）
const VOW = { あ: "あかさたなはまやらわがざだばぱぁゃ", い: "いきしちにひみりぎじぢびぴぃ", う: "うくすつぬふむゆるぐずづぶぷぅゅっ", え: "えけせてねへめれげぜでべぺぇ", お: "おこそとのほもよろをごぞどぼぽぉょ" };
const vowelOf = c => Object.keys(VOW).find(v => VOW[v].includes(c)) || "";
const norm = s => {
  let t = hira(s).replace(/[^ぁ-んー]/g, "");
  t = t.replace(/(.)ー/g, (m, c) => c + vowelOf(c));
  return t.replace(/おう/g, "おお").replace(/えい/g, "ええ").replace(/^いう/, "ゆう");
};
const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const id = t => createHash("sha1").update(t).digest("hex").slice(0, 12);

async function tts(input) {
  for (let w = 0; ; w++) {
    const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", { method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": TTS_KEY },
      body: JSON.stringify({ input, voice: { languageCode: "ja-JP", name: VOICE }, audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000 } }) });
    if (r.ok) return Buffer.from((await r.json()).audioContent, "base64");
    if (w < 5 && (r.status === 429 || r.status >= 500)) { await sleep(3000 * (w + 1)); continue; }
    throw new Error(`tts ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
}
async function hear(wav) {   // 聞こえたとおりをひらがなで
  for (let w = 0; ; w++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${JUDGE}:generateContent`, { method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEM_KEY },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } },
        { text: "この音声は日本語の単語を1つ読んだものです。聞こえた音を、そのまま全部ひらがなで書いてください（漢字は使わない）。意味から推測して直さず、聞こえたとおりに。ひらがなだけを答えてください。" }] }],
        generationConfig: { temperature: 0 } }) });
    if (r.ok) { const d = await r.json(); return d.candidates[0].content.parts.map(p => p.text || "").join("").trim(); }
    if (w < 20 && (r.status === 429 || r.status >= 500)) { await sleep(3000 * (w + 1)); continue; }
    throw new Error(`judge ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
}
function toMp3(wav, out) {
  const tmp = out + ".wav"; fs.writeFileSync(tmp, wav);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp,
    "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse",
    "-ac", "1", "-ar", "24000", "-b:a", "40k", out]);
  fs.unlinkSync(tmp);
}

const LEVEL = process.env.LEVEL || "n5";
const words = VOCAB.filter(v => v.id.startsWith(LEVEL + "-"));
const MAN = "voice_list.json", man = JSON.parse(fs.readFileSync(MAN, "utf8"));
const logPath = "qa/voice_tts_log.json", log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")) : {};
const save = () => {
  fs.writeFileSync(MAN, JSON.stringify(man)); fs.writeFileSync(logPath, JSON.stringify(log, null, 1));
  fs.writeFileSync("voice.js", "// 前もって作ったお手本の声。文 → voice/ のファイル名\nexport const VOICE = " + JSON.stringify(man) + ";\n");
};
let ok = 0, ng = 0, n = 0;
async function work(v) {
  if (log[v.word]?.ok && log[v.word].voice === VOICE) return;
  const kana = hira(v.reading);
  const ways = [["漢字", { text: v.word }], ["読み指定", { ssml: `<speak><sub alias="${esc(kana)}">${esc(v.word)}</sub></speak>` }], ["ひらがな", { text: kana }]];
  const heard = [];
  for (const [how, input] of ways) {
    const wav = await tts(input);
    let t = await hear(wav);
    if (norm(t) !== norm(kana)) { heard.push(`${how}:${t}`); t = await hear(wav); }
    heard.push(`${how}:${t}`);
    if (norm(t) === norm(kana)) {
      const f = id(v.word) + "g.mp3";
      toMp3(wav, `voice/${f}`);
      man[v.word] = f; log[v.word] = { ok: true, voice: VOICE, how, heard: t }; ok++;
      return;
    }
  }
  delete man[v.word]; log[v.word] = { ok: false, voice: VOICE, heard }; ng++;
}
let i = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (i < words.length) { const v = words[i++]; await work(v); if (++n % 20 === 0) { save(); console.log(`${n}/${words.length} 合格${ok} 不合格${ng}`); } }
}));
save();
console.log(`おわり: 合格${ok} 不合格${ng}`);
