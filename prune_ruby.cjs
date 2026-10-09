// ruby.js から、確かでないふりがなを取り除く（取り除いた文は、ふりがなを付けずに表示される）。
// 残す条件：①読みが「漢字のすぐあと」に付いている ②文の中の漢字すべてに読みがある
//           ③数字を含まない文は、辞書（kuromoji）の読みと全体が一致する
//           ④数字を含む文は、①②に加え、まちがえやすい読み（分・日・人・度）の決まりに合う
const fs = require("fs");
const kuromoji = require("kuromoji");
const path = process.argv[2];
const src = fs.readFileSync(path, "utf8");
const header = src.slice(0, src.indexOf("export const RUBY = "));
const RUBY = JSON.parse(src.replace(/^[\s\S]*?export const RUBY = /, "").replace(/;\s*$/, ""));
const k2h = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const KJ = "一-龯々〆ヶ";
const strip = s => s.replace(/[\s　。、，．・「」『』（）()！？!?：:〜~ーｰ―‐\-＋+÷×/]/g, "");

// 準備: npm install --no-save kuromoji@0.1.2   使い方: node prune_ruby.cjs ruby.js
kuromoji.builder({ dicPath: require("path").join(require.resolve("kuromoji"), "../../dict") }).build((err, tk) => {
  if (err) throw err;
  const keep = {}, drop = [];
  for (const [orig, ruby] of Object.entries(RUBY)) {
    const why = [];
    // ① 「(よみ)」の直前は漢字か数字（「青い(あおい)」「聞き(きき)」は×）
    if (/[^0-9０-９一-龯々〆ヶ]\([ぁ-んー]+\)/.test(ruby)) why.push("位置");
    // ② 読みを外したあとに、読みのない漢字が残っていない
    const rest = ruby.replace(/｜/g, "").replace(new RegExp(`[0-9０-９]*[${KJ}]+\\([ぁ-んー]+\\)`, "g"), "");
    if (new RegExp(`[${KJ}]`).test(rest)) why.push("読みなし");
    const hasNum = /[0-9０-９]/.test(orig);
    if (!hasNum) {
      // ③ 辞書と比べる
      const ai = k2h(ruby.replace(/｜/g, "").replace(new RegExp(`[${KJ}]+\\(([ぁ-んー]+)\\)`, "g"), "$1"));
      const dic = k2h(tk.tokenize(orig).map(t => t.reading && t.reading !== "*" ? t.reading : t.surface_form).join(""));
      if (strip(ai) !== strip(dic)) why.push(`辞書と違う（AI:${strip(ai).slice(0, 30)} 辞書:${strip(dic).slice(0, 30)}）`);
    } else {
      // ④ まちがえやすい数字の読み
      if (/度5分\([^)]*ごふん/.test(ruby) || /何\(なん\)か[をが]/.test(ruby)) why.push("数字の読み");
    }
    if (why.length) drop.push({ orig, ruby, why: why.join(" / ") }); else keep[orig] = ruby;
  }
  fs.writeFileSync(path, header + "export const RUBY = " + JSON.stringify(keep) + ";\n");
  fs.mkdirSync("qa", { recursive: true }); fs.writeFileSync("qa/ruby_dropped.json", JSON.stringify(drop, null, 1));
  console.log(`残した ${Object.keys(keep).length}、取り除いた ${drop.length}`);
});
