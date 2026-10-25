// 例文のお手本の声を作る（Google の読み上げ専用サービス、声は Chirp3 Aoede）。
// 1. 例文は学ぶ人向けにひらがなが多い（ふって・かさ）ので、読み上げ用だけ普通の漢字まじりの文に直す（かしこいAI）。
//    直した文の読みが元の読みと同じか、kuromoji で確かめる。ちがえば元の文のまま読ませる。
// 2. 声を作る → かしこいAIに聞き取らせ、読みが合っているか確かめる。合わなければ元の文で作り直す。
//    それでも合わない文は声を入れたうえで「要確認」にする（竹澤さんの耳で確かめる）。
// 使い方: node make_voice_ex.mjs [n5]   （キー: GOOGLE_TTS_KEY と GEMINI_API_KEY）
import fs from "fs";
import { execFileSync } from "child_process";
import { createHash } from "crypto";
import { createRequire } from "module";
import { VOCAB } from "./vocab.js";
import { RUBY } from "./ruby.js";
import { speechOf } from "./yomi.js";
const require = createRequire(import.meta.url);
const kuromoji = require("kuromoji");

const env = n => process.env[n] || execFileSync("powershell", ["-NoProfile", "-Command", `[Environment]::GetEnvironmentVariable('${n}','User')`]).toString().trim();
const TTS_KEY = env("GOOGLE_TTS_KEY"), GEM_KEY = env("GEMINI_API_KEY");
const VOICE = "ja-JP-Chirp3-HD-Aoede", JUDGE = "gemini-3.5-flash";
const joinJa = s => s.replace(/(?<=[^\x00-\x7F])[ 　]+(?=[^\x00-\x7F])/g, "");
const hira = s => String(s).replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const VOW = { あ: "あかさたなはまやらわがざだばぱぁゃ", い: "いきしちにひみりぎじぢびぴぃ", う: "うくすつぬふむゆるぐずづぶぷぅゅっ", え: "えけせてねへめれげぜでべぺぇ", お: "おこそとのほもよろをごぞどぼぽぉょ" };
const vowelOf = c => Object.keys(VOW).find(v => VOW[v].includes(c)) || "";
// 読みのくらべ方：長音・助詞の書き方（は／わ、へ／え、を／お）のちがいは同じとみなす
const norm = s => {
  let t = hira(s).replace(/[^ぁ-んー]/g, "");
  t = t.replace(/(.)ー/g, (m, c) => c + vowelOf(c));
  return t.replace(/おう/g, "おお").replace(/えい/g, "ええ").replace(/は/g, "わ").replace(/へ/g, "え").replace(/を/g, "お").replace(/ぢ/g, "じ").replace(/づ/g, "ず");
};
function similar(a, b) {   // 1 - 編集距離 / 長さ
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n, 1);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const id = t => createHash("sha1").update(t).digest("hex").slice(0, 12);

async function gemini(parts, json) {
  for (let w = 0; ; w++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${JUDGE}:generateContent`, { method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEM_KEY },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0, ...(json ? { responseMimeType: "application/json" } : {}) } }) });
    if (r.ok) { const d = await r.json(); return d.candidates[0].content.parts.map(p => p.text || "").join("").trim(); }
    if (w < 20 && (r.status === 429 || r.status >= 500)) { await sleep(3000 * (w + 1)); continue; }
    throw new Error(`gemini ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
}
async function tts(input) {
  if (typeof input === "string") input = { text: input };
  for (let w = 0; ; w++) {
    const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", { method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": TTS_KEY },
      body: JSON.stringify({ input, voice: { languageCode: "ja-JP", name: VOICE }, audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: 24000 } }) });
    if (r.ok) return Buffer.from((await r.json()).audioContent, "base64");
    if (w < 5 && (r.status === 429 || r.status >= 500)) { await sleep(3000 * (w + 1)); continue; }
    throw new Error(`tts ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
}
const hear = wav => gemini([{ inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } },
  { text: "この音声は日本語の文を1つ読んだものです。聞こえた音を、そのまま全部ひらがなで書いてください（漢字・カタカナ・記号は使わない）。意味から推測して直さず、聞こえたとおりに。ひらがなだけを答えてください。" }]);
function toMp3(wav, out) {
  const tmp = out + ".wav"; fs.writeFileSync(tmp, wav);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp,
    "-af", "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.2,areverse",
    "-ac", "1", "-ar", "24000", "-b:a", "48k", out]);
  fs.unlinkSync(tmp);
}

// ふりがなどおりに読ませる SSML（漢字ごとに読みを指定）
const SEG = /(?:｜([^｜(（]+?)|([一-龯々〆ヶ]+))\(([ぁ-んァ-ヶー]+)\)/g;
const subSsml = ja => { const r = RUBY[ja]; if (!r) return null; return "<speak>" + joinJa(r.replace(SEG, (m, a, b, y) => `<sub alias="${y}">${a ?? b}</sub>`).replace(/｜/g, "")) + "</speak>"; };

const tokenizer = await new Promise((ok, ng) => kuromoji.builder({ dicPath: "node_modules/kuromoji/dict" }).build((e, t) => e ? ng(e) : ok(t)));
const readOf = s => tokenizer.tokenize(s).map(t => t.reading && t.reading !== "*" ? t.reading : t.surface_form).join("");

const LEVEL = process.argv[2] || "";
const items = [];
for (const v of VOCAB) if (!LEVEL || v.id.startsWith(LEVEL + "-")) for (const e of v.ex) {
  const sp = speechOf(e.ja, "", RUBY);
  items.push({ ja: e.ja, text: joinJa(sp.text), kana: joinJa(sp.kana) });
}
const MAN = "voice_list.json", man = JSON.parse(fs.readFileSync(MAN, "utf8"));
const logPath = "qa/voice_ex_log.json", log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")) : {};
const save = () => {
  fs.writeFileSync(MAN, JSON.stringify(man)); fs.writeFileSync(logPath, JSON.stringify(log, null, 1));
  const wlog = JSON.parse(fs.readFileSync("qa/voice_tts_log.json", "utf8"));
  const chk = [...Object.keys(wlog).filter(w => wlog[w].check && man[w]), ...Object.keys(log).filter(t => log[t].check && man[t])];
  fs.writeFileSync("voice.js", "// 前もって作ったお手本の声。文 → voice/ のファイル名\nexport const VOICE = " + JSON.stringify(man) + ";\nexport const VOICE_CHECK = " + JSON.stringify(chk) + ";\n");
};
// REDO=1 … 読みがぴったり合わなかった文（score < 1）だけ作り直す
const todo = items.filter(it => process.env.REDO ? (log[it.ja] && log[it.ja].score < 1 && !log[it.ja].picked) : !(log[it.ja]?.voice === VOICE && man[it.ja])).slice(0, +process.env.LIMIT || Infinity);
console.log(`例文 ${items.length}文 / 今回 ${todo.length}文`);

// 1. 読み上げ用の漢字まじり文（40文ずつ）
for (let i = 0; i < todo.length; i += 40) {
  const batch = todo.slice(i, i + 40).filter(it => !log[it.ja]?.ttsText);
  if (!batch.length) continue;
  const prompt = "次の日本語の文は、日本語を学ぶ人向けに、ふつうは漢字で書く語をひらがなで書いてあります。読み上げソフトに読ませるため、ふつうの大人向けの漢字かなまじり文に直してください。\n" +
    "・語の並び・言い回し・助詞・句読点は一切変えない。読み（音）が変わる直し方はしない。\n・ひらがなのままが自然な語（こと、ところ、ください など）はそのまま。\n・数字・記号もそのまま。\n" +
    "答えは JSON の配列で、入力と同じ順に、直した文の文字列だけを並べる。\n入力:\n" + JSON.stringify(batch.map(it => it.text));
  let out = [];
  try { out = JSON.parse(await gemini([{ text: prompt }], true)); } catch (e) { console.log("漢字直し失敗", e.message.slice(0, 80)); }
  batch.forEach((it, k) => {
    const t = typeof out[k] === "string" ? out[k] : "";
    const ok = t && norm(readOf(t)) === norm(readOf(it.text));   // 直す前と後で読みが同じか
    log[it.ja] = { ...(log[it.ja] || {}), ttsText: ok ? t : it.text, kanjiOk: !!ok };
  });
  console.log(`漢字直し ${Math.min(i + 40, todo.length)}/${todo.length}`);
}
save();

// 2. 声を作って、読みを聞き取りで確かめる
let ok = 0, chk = 0, n = 0, i = 0;
async function work(it) {
  const L = log[it.ja], want = norm(it.kana);
  // 漢字に直した文 → ふりがなどおりに漢字1つずつ読みを指定 → 元の文 の順に試す
  const sub = subSsml(it.ja);
  const tries = [L.ttsText, ...(sub ? [{ ssml: sub }] : []), it.text].filter((t, k, a) => a.findIndex(u => JSON.stringify(u) === JSON.stringify(t)) === k);
  let best = null;
  for (const text of tries) {
    const wav = await tts(text);
    const heard = await hear(wav);
    const s = similar(norm(heard), want);
    if (!best || s > best.s) best = { wav, heard, s, text };
    if (s === 1) break;   // 1文字でもちがえば次の読ませ方へ
  }
  const f = id(it.ja) + "e.mp3";
  toMp3(best.wav, `voice/${f}`);
  man[it.ja] = f;
  log[it.ja] = { ...L, voice: VOICE, used: typeof best.text === "string" ? best.text : best.text.ssml, heard: best.heard, score: +best.s.toFixed(3), check: best.s < 1 };
  best.s === 1 ? ok++ : chk++;
}
await Promise.all(Array.from({ length: 6 }, async () => {
  while (i < todo.length) {
    const it = todo[i++];
    try { await work(it); } catch (e) { console.log("失敗", it.ja, e.message.slice(0, 100)); }
    if (++n % 50 === 0) { save(); console.log(`${n}/${todo.length} 合格${ok} 要確認${chk}`); }
  }
}));
save();
console.log(`おわり: 合格${ok} 要確認${chk}`);
