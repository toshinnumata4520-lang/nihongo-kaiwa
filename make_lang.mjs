// インドネシア語（id）・タガログ語（tl）の訳の表（lang_extra.js）を作る。
// アプリの英語の文（画面の言葉・場面・状況カード・ルールとマナー・試験の解説）を集め、文字のAIで訳す。
// 使い方: node make_lang.mjs   （GEMINI_API_KEY または .devkey。作り済みの文は飛ばす。LANG_MODEL でモデルを変えられる）
import fs from "fs";
import { SCENES } from "./scenes.js";
import { SITUATIONS } from "./situations.js";
import { MANNERS, MANNER_CATS } from "./manners.js";
import { EXAMS } from "./exams.js";

const KEY = process.env.GEMINI_API_KEY || (fs.existsSync(".devkey") ? fs.readFileSync(".devkey", "utf8").trim() : "");
if (!KEY) { console.error("APIキーがありません"); process.exit(1); }
const MODEL = process.env.LANG_MODEL || "gemini-3.5-flash-lite";
const NAMES = { id: "Indonesian (Bahasa Indonesia)", tl: "Tagalog (Filipino)" };

const texts = new Set();
const add = s => { if (typeof s === "string" && s.trim()) texts.add(s); };
// 画面の言葉（i18n.js の en）。モジュールは localStorage を使うので、ファイルから取り出す
const i18nSrc = fs.readFileSync("i18n.js", "utf8");
for (const m of i18nSrc.matchAll(/\ben:\s*"((?:[^"\\]|\\.)*)"/g)) add(JSON.parse(`"${m[1]}"`));
// 業種の名前（app.js の INDUSTRY）
const appSrc = fs.readFileSync("app.js", "utf8");
for (const m of appSrc.matchAll(/furi: "[^"]*", en: "((?:[^"\\]|\\.)*)"/g)) add(JSON.parse(`"${m[1]}"`));
for (const sc of SCENES) { add(sc.title?.en); add(sc.goal?.en); sc.key_phrases.forEach(p => add(p.en)); }
for (const s of Object.values(SITUATIONS)) { add(s.you.en); add(s.now.en); s.todo.forEach(x => add(x.en)); }
for (const c of MANNER_CATS) add(c.en);
for (const m of MANNERS) { add(m.title.en); add(m.point.en); add(m.why.en); add(`${m.point.en} ${m.why.en}`); }
for (const q of EXAMS) add(q.explain_en);

const OUT = "lang_extra.js";
const read = () => JSON.parse(fs.readFileSync(OUT, "utf8").replace(/^[\s\S]*?export const EXTRA = /, "").replace(/;\s*$/, ""));
const extra = fs.existsSync(OUT) ? read() : { id: {}, tl: {} };

async function ask(lang, batch) {
  const prompt = `Translate each English text into ${NAMES[lang]} for foreign workers in Japan who are learning Japanese.
Rules:
- Simple, natural, polite everyday language. Short sentences.
- Keep Japanese words written in romaji or Japanese script (e.g. “Ohayō gozaimasu”, “Hō-Ren-Sō”, 110, 119) exactly as they are.
- Keep numbers, times, symbols, emoji and line breaks.
- Return a JSON array with exactly ${batch.length} strings in the same order.
${batch.map((t, i) => `${i + 1}. ${JSON.stringify(t)}`).join("\n")}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: { type: "ARRAY", items: { type: "STRING" } }, temperature: 0.2 } }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
  const d = await res.json();
  return JSON.parse(d.candidates[0].content.parts.map(p => p.text).join(""));
}

const save = () => fs.writeFileSync(OUT, `// インドネシア語（id）・タガログ語（tl）の訳。キー＝英語の文、値＝訳（make_lang.mjs で作る。手で直してもよい）\nexport const EXTRA = ${JSON.stringify(extra)};\n`);
for (const lang of ["id", "tl"]) {
  const todo = [...texts].filter(t => !(t in extra[lang]));
  console.log(`${lang}: 全部 ${texts.size}、新しく訳す ${todo.length}`);
  for (let i = 0; i < todo.length; i += 40) {
    const batch = todo.slice(i, i + 40);
    let out = null;
    for (let tries = 0; tries < 4 && !out; tries++) {
      try { out = await ask(lang, batch); }
      catch (e) { console.log("エラー", e.message.slice(0, 60)); if (!/^429|^5\d\d/.test(e.message)) break; await new Promise(r => setTimeout(r, 30000 * (tries + 1))); }
    }
    // 数が合わない・空・英語のまま のものは使わない
    if (out && out.length === batch.length) batch.forEach((t, k) => { const v = out[k]; if (v && v.trim() && (v !== t || t.length < 12)) extra[lang][t] = v; });
    save();
    process.stdout.write(`${Math.min(i + 40, todo.length)}/${todo.length} `);
  }
  console.log();
}
console.log("id", Object.keys(extra.id).length, "tl", Object.keys(extra.tl).length);
