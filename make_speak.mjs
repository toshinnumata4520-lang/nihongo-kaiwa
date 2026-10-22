// スマホの読み上げ（端末の声）に渡す文を作る。
// 全部ひらがなにして渡すとアクセントが崩れるので、ふだんは漢字まじりの文のまま渡す。
// ただし、端末の辞書が読みをまちがえそうな語（ふりがな表の読み ≠ kuromoji の読み）だけ、その部分をひらがなにする。
// 単語（vocab.js の word）も同じ考えで、辞書の読みが合わないものだけ読みを渡す。
// 使い方: node make_speak.mjs  → speak.js（ちがいのある文だけを書き出す）
import fs from "fs";
import { createRequire } from "module";
import { RUBY } from "./ruby.js";
import { VOCAB } from "./vocab.js";
const require = createRequire(import.meta.url);
const kuromoji = require("kuromoji");

const KANJI = /[一-龯々〆ヶ]/;
const hira = s => String(s).replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const norm = s => hira(s).replace(/[^ぁ-んー一-龯々0-9０-９a-zA-Z]/g, "");
const SEG = /(?:｜([^｜(（]+?)|([一-龯々〆ヶ]+))\(([ぁ-んァ-ヶー]+)\)/g;

// ふりがなの文から、元の文と「漢字の区間と読み」の一覧を作る
function parse(r) {
  let plain = "", last = 0;
  const segs = [];
  for (const m of r.matchAll(SEG)) {
    plain += m.input.slice(last, m.index).replace(/｜/g, "");
    const base = m[1] ?? m[2];
    segs.push({ a: plain.length, b: plain.length + base.length, y: hira(m[3]) });
    plain += base;
    last = m.index + m[0].length;
  }
  plain += r.slice(last).replace(/｜/g, "");
  return { plain, segs };
}

const tokenizer = await new Promise((ok, ng) => kuromoji.builder({ dicPath: "node_modules/kuromoji/dict" }).build((e, t) => e ? ng(e) : ok(t)));

function speakOf(text, r) {
  const { plain, segs } = parse(r);
  if (plain !== text || !segs.length) return null;
  const toks = [];
  let p = 0;
  for (const t of tokenizer.tokenize(plain)) {
    const s = t.surface_form;
    toks.push({ a: p, b: p + s.length, y: hira(t.reading && t.reading !== "*" ? t.reading : s) });
    p += s.length;
  }
  const kanaSeg = new Set();
  for (let i = 0; i < segs.length; i++) {
    // 区間を、重なるトークンと区間がぜんぶ入るまで広げる
    let a = segs[i].a, b = segs[i].b, changed = true;
    while (changed) {
      changed = false;
      for (const t of toks) if (t.a < b && t.b > a && (t.a < a || t.b > b)) { a = Math.min(a, t.a); b = Math.max(b, t.b); changed = true; }
      for (const s of segs) if (s.a < b && s.b > a && (s.a < a || s.b > b)) { a = Math.min(a, s.a); b = Math.max(b, s.b); changed = true; }
    }
    const inSpan = toks.filter(t => t.a >= a && t.b <= b);
    if (inSpan.some(t => /[0-9０-９]/.test(plain.slice(t.a, t.b)))) continue;   // 数字の読み（8時など）は端末の声にまかせる
    const kr = inSpan.map(t => t.y).join("");
    let ours = "";
    for (let q = a; q < b;) {
      const s = segs.find(s => s.a === q);
      if (s) { ours += s.y; q = s.b; } else { ours += hira(plain[q]); q++; }
    }
    if (norm(kr) !== norm(ours)) segs.forEach((s, j) => { if (s.a >= a && s.b <= b) kanaSeg.add(j); });
  }
  if (!kanaSeg.size) return null;
  let out = "", q = 0;
  segs.forEach((s, j) => { if (kanaSeg.has(j)) { out += plain.slice(q, s.a) + s.y; q = s.b; } });
  return out + plain.slice(q);
}

const SPEAK = {};
let n = 0;
for (const [text, r] of Object.entries(RUBY)) {
  const s = speakOf(text, r);
  if (s) { SPEAK[text] = s; n++; }
}
for (const v of VOCAB) {
  if (!KANJI.test(v.word) || SPEAK[v.word]) continue;
  const kr = tokenizer.tokenize(v.word).map(t => hira(t.reading && t.reading !== "*" ? t.reading : t.surface_form)).join("");
  if (norm(kr) !== norm(v.reading)) { SPEAK[v.word] = v.reading; n++; }
}
fs.writeFileSync("speak.js",
  "// 端末の読み上げに渡す文（make_speak.mjs で作る）。ここにない文は、漢字まじりのまま読ませる\n" +
  "export const SPEAK = " + JSON.stringify(SPEAK) + ";\n");
console.log("speak.js:", n, "件（ひらがなにした部分がある文・単語）/ 全", Object.keys(RUBY).length);
