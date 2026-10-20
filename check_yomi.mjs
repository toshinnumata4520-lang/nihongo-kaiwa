// 読み上げの文字列の点検：アプリの 🔊 が実際に読み上げに渡す文字列を全部作って、おかしいものを数える。
// 使い方: node check_yomi.mjs          （問題のあるものだけ表示）
//         node check_yomi.mjs --all    （全部を qa/yomi_all.txt に書き出す）
// app.js の呼び出しと同じ組み合わせ（text と reading）で yomi.js の speechOf を通す。
import fs from "fs";
import { speechOf } from "./yomi.js";
import { RUBY } from "./ruby.js";
import { SCENES } from "./scenes.js";
import { MANNERS } from "./manners.js";
import { DRILLS } from "./drills.js";
import { VOCAB } from "./vocab.js";
import { EXAMS } from "./exams.js";

// app.js と同じく、場面の名前の「業種：内容」も表に足す（読み上げには使わないが、そろえておく）
const items = [];   // [どこ, text, reading, AIの声にも渡るか]
const add = (where, text, reading = "", ai = true) => items.push({ where, text, reading, ai });
for (const m of MANNERS) add(`ルール ${m.id}`, m.point.ja);
for (const sc of SCENES) for (const p of sc.key_phrases) add(`場面 ${sc.id}`, p.ja, p.furigana);
for (const d of DRILLS) { add(`くりかえす ${d.id} 指示`, d.say, d.say_kana); add(`くりかえす ${d.id} お手本`, d.model, d.model_kana); }
for (const v of VOCAB) {
  add(`単語 ${v.id}`, v.word, v.reading);
  add(`単語 ${v.id} 聞き取り`, v.reading, v.reading, false);
  v.ex.forEach((e, k) => add(`単語 ${v.id} 例文${k + 1}`, e.ja));
}
for (const q of EXAMS) {
  if (q.say) add(`用語 ${q.id}`, q.term || q.say, q.say);
  if (q.script) for (const l of q.script.split("\n")) { const m = l.match(/^([^：]{1,6})：(.*)$/); add(`聴解 ${q.id}`, m ? m[2] : l, "", false); }
}

const OK_CHARS = /^[ぁ-んァ-ヶー、。！？ 　]*$/;
const problems = [];
const lines = [];
for (const it of items) {
  const r = speechOf(it.text, it.reading, RUBY);
  const why = [];
  if (!r.kanaOk) why.push("漢字が残る");
  if (/[0-9０-９]/.test(r.kana)) why.push("数字が残る");
  if (/[A-Za-zＡ-Ｚａ-ｚ]/.test(r.kana)) why.push("英字が残る");
  const bad = [...r.kana].filter(c => !OK_CHARS.test(c));
  if (bad.length) why.push("記号が残る：" + [...new Set(bad)].join(""));
  if (/[ぁ-ん]\(|\)/.test(r.kana)) why.push("ふりがなの形が残る");
  if (/、、|^、|、。/.test(r.kana)) why.push("区切りが不自然");
  if (it.ai && /[①-⑩（）()「」『』【】＝／・…📖]/.test(r.text)) why.push("AIに渡す文に記号");
  lines.push(`${it.where}\n  画面：${it.text}\n  AI　：${r.text}\n  読み：${r.kana}`);
  if (why.length) problems.push(`${it.where}［${why.join("・")}］\n  画面：${it.text}\n  読み：${r.kana}`);
}
if (process.argv.includes("--all")) {
  fs.mkdirSync("qa", { recursive: true });
  fs.writeFileSync("qa/yomi_all.txt", lines.join("\n"));
  console.log("qa/yomi_all.txt に書き出し");
}
console.log(problems.join("\n"));
console.log(`見た件数 ${items.length}　問題 ${problems.length}`);
