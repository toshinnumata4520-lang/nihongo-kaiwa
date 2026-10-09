// 画面の日本語にふりがなを付けるための表（ruby.js）を作る。
// 漢字を含む文を集め、文字のAIに「漢字(よみ)」の形で読みを付けさせる。
// 付けた読みを外すと元の文に戻ること（文が変わっていないこと）を確かめ、合わないものは使わない。
// 使い方: node make_ruby.mjs   （GEMINI_API_KEY または .devkey。作り済みの文は飛ばす。RUBY_MODEL でモデルを変えられる）
// 作ったあとは必ず node prune_ruby.cjs ruby.js で、辞書の読みと合わないものを取り除く
import fs from "fs";
import { SCENES } from "./scenes.js";
import { SITUATIONS } from "./situations.js";
import { DRILLS } from "./drills.js";
import { EXAMS } from "./exams.js";

const KEY = process.env.GEMINI_API_KEY || (fs.existsSync(".devkey") ? fs.readFileSync(".devkey", "utf8").trim() : "");
if (!KEY) { console.error("APIキーがありません"); process.exit(1); }
const MODEL = process.env.RUBY_MODEL || "gemini-3.5-flash";
const KANJI = /[一-龯々〆ヶ]/;

// 画面の言葉（i18n.js の ja）は、ファイルから文字列を取り出す（モジュールは localStorage を使うので読み込めない）
const i18nSrc = fs.readFileSync("i18n.js", "utf8");
const uiJa = [...i18nSrc.matchAll(/\bja:\s*"((?:[^"\\]|\\.)*)"/g)].map(m => JSON.parse(`"${m[1]}"`));

const texts = new Set();
const add = s => { if (typeof s === "string" && KANJI.test(s)) texts.add(s); };
uiJa.forEach(add);
for (const sc of SCENES) { add(sc.title_ja); add(sc.goal_ja); (sc.hints || []).forEach(add); sc.title_ja.split("：").forEach(add); add(sc.title_ja.split("：").slice(1).join("：")); }
for (const s of Object.values(SITUATIONS)) { add(s.you.ja); add(s.now.ja); s.todo.forEach(x => add(x.ja)); }
for (const d of DRILLS) add(d.speaker);
for (const q of EXAMS) {
  add(q.section); add(q.explain_ja);
  if (q.choices && !q.term) q.choices.forEach(add);
  if (q.answer_text) add(q.answer_text);
}

const OUT = "ruby.js";
const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8").replace(/^[\s\S]*?export const RUBY = /, "").replace(/;\s*$/, "")) : {};
const todo = [...texts].filter(t => !(t in old));
console.log(`全部 ${texts.size} 文、新しく作る ${todo.length} 文`);

const strip = s => s.replace(/｜/g, "").replace(/\(([ぁ-んー]+)\)/g, "");
const ok = (src, out) => strip(out) === src && /\([ぁ-んー]+\)/.test(out) && !/\([^ぁ-んー)]*\)/.test(out.replace(/\(([ぁ-んー]+)\)/g, ""));

async function ask(batch) {
  const prompt = `次の日本語の文それぞれに、ふりがなを付けてください。外国人の日本語学習者（N4〜N3）が読むための、ふりがなです。
決まり：
- 漢字のすぐあとに、半角かっこでひらがなの読みを付ける。例：薬(くすり)を 飲(の)んで ください。
- 読みは、その漢字の部分だけ。送りがなは かっこの外に そのまま残す。例：遅(おく)れる、話(はな)す
- 熟語は まとめてよい。例：危険(きけん)、作業手順(さぎょうてじゅん)
- 数字＋漢字の助数詞は、数字の前に「｜」を置いて まとめる。例：｜3日(みっか)、｜2人(ふたり)、｜10分(じゅっぷん)。読みが特別でない助数詞は漢字だけに付けてよい。例：20個(こ)
- 元の文の文字は、1文字も変えない・足さない・消さない（空白・記号・かっこも そのまま）。かっこ「(」「)」を 新しく使うのは、読みのときだけ。
- 文脈に合う正しい読みにする。例：今日(きょう)、上手(じょうず)、一人(ひとり)
入力の順番どおりに、配列で返す。
${batch.map((t, i) => `${i + 1}. ${t}`).join("\n")}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: { type: "ARRAY", items: { type: "STRING" } }, temperature: 0 } }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const d = await res.json();
  return JSON.parse(d.candidates[0].content.parts.map(p => p.text).join(""));
}

const result = { ...old };
const bad = [];
for (let i = 0; i < todo.length; i += 30) {
  const batch = todo.slice(i, i + 30);
  let out = [];
  // 利用回数の上限（429）のときは、少し待ってからやり直す
  for (let tries = 0; tries < 4; tries++) {
    try { out = await ask(batch); break; }
    catch (e) {
      console.log("エラー", e.message.slice(0, 60));
      if (!/^429/.test(e.message)) break;
      await new Promise(r => setTimeout(r, 30000 * (tries + 1)));
    }
  }
  batch.forEach((t, k) => {
    const r = out[k];
    // かっこを使う元の文（例：KY）は、比べるときに困るので、元の文に半角かっこがあるものは対象外
    if (r && !/[()]/.test(t) && ok(t, r)) result[t] = r; else bad.push(t);
  });
  process.stdout.write(`${Math.min(i + 30, todo.length)}/${todo.length} `);
}
fs.writeFileSync(OUT, `// 画面の日本語のふりがな（make_ruby.mjs で作る。手で直してもよい）。キー＝元の文、値＝「漢字(よみ)」の形\nexport const RUBY = ${JSON.stringify(result, null, 0)};\n`);
console.log(`\n${Object.keys(result).length} 文を保存。使えなかった文 ${bad.length}`);
if (bad.length) fs.writeFileSync("qa/ruby_failed.txt", bad.join("\n"));
