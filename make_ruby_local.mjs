// AIを使わずに、PCの辞書（kuromoji）でふりがなを付ける（AIの利用上限のときの代わり）。
// 専門用語は辞書だとまちがえやすいので、TERMS に読みを書いておき、先にそれを使う。
// 使い方: node make_ruby_local.mjs   （ruby.js にない文だけ足す。kuromoji は npm i --no-save kuromoji で入れる）
import fs from "fs";
import { createRequire } from "module";
import { SCENES } from "./scenes.js";
import { SITUATIONS } from "./situations.js";
import { DRILLS } from "./drills.js";
import { EXAMS } from "./exams.js";
import { vocabTexts } from "./vocab.js";
import { fixRuby } from "./ruby_fixes.mjs";
const require = createRequire(import.meta.url);
const kuromoji = require("kuromoji");

// 辞書だと読みをまちがえやすい語（長いものから先に当てる）
const TERMS = {
  陸墨: "ろくずみ", 逃げ墨: "にげずみ", 返り墨: "かえりずみ", 墨出し: "すみだし", 基準墨: "きじゅんずみ", 親墨: "おやずみ", 墨付け: "すみつけ", 墨: "すみ",
  面一: "つらいち", 不陸: "ふりく", 法面: "のりめん", 根切り: "ねぎり", 床付け: "とこづけ", 躯体: "くたい", 矩: "かね", 人工: "にんく",
  山留め: "やまどめ", 釜場: "かまば", 水替え: "みずかえ", 捨てコンクリート: "すてコンクリート", 捨てコン: "すてコン", 打設: "だせつ",
  筋交い: "すじかい", 筋交: "すじかい", 筋かい: "すじかい", 幅木: "はばき", 巾木: "はばき", 建地: "たてじ", 間柱: "まばしら", 管柱: "くだばしら", 通し柱: "とおしばしら",
  玉掛け: "たまかけ", 継手: "つぎて", 場所打ち: "ばしょうち", 手戻り: "てもどり", 手直し: "てなおし", 手待ち: "てまち", 手違い: "てちがい", 段取り: "だんどり",
  職長: "しょくちょう", 元請: "もとうけ", 下請: "したうけ", 施工: "せこう", 養生: "ようじょう", 墜落: "ついらく", 脚立: "きゃたつ", 雨仕舞: "あまじまい",
  宮大工: "みやだいく", 左官: "さかん", 漆喰: "しっくい", 勾配: "こうばい", 雑排水: "ざつはいすい", 汚水: "おすい", 駄目直し: "だめなおし", 駄目: "だめ",
  一間: "いっけん", 一尺: "いっしゃく", 一寸: "いっすん", 一坪: "ひとつぼ", 取合い: "とりあい", 支保工: "しほこう", 支持層: "しじそう", 既成杭: "きせいぐい",
  杭: "くい", 釘: "くぎ", 鉄筋: "てっきん", 鉄骨: "てっこつ", 型枠: "かたわく", 足場: "あしば", 壁つなぎ: "かべつなぎ", 作業床: "さぎょうゆか",
  建て逃げ: "たてにげ", 水平積上げ: "すいへいつみあげ", 剛接合: "ごうせつごう", 免震: "めんしん", 制振: "せいしん", 雨どい: "あまどい",
  生コン: "なまコン", 締固め: "しめかため", 埋め戻し: "うめもどし", 盛り土: "もりど", 切り土: "きりど", 地山: "じやま", 根入れ: "ねいれ",
  上棟: "じょうとう", 胴差: "どうさし", 小屋束: "こやづか", 母屋: "もや", 棟木: "むなぎ", 垂木: "たるき", 野地板: "のじいた", 鴨居: "かもい", 敷居: "しきい",
  打診棒: "だしんぼう", 金のこ: "かなのこ", 剣スコップ: "けんスコップ", 角スコップ: "かくスコップ", 下げ振り: "さげふり", 水糸: "みずいと", 水貫: "みずぬき",
  遣り方: "やりかた", 丁張り: "ちょうはり", 地縄張り: "じなわばり", 矢板: "やいた", 擁壁: "ようへき", 素掘り: "すぼり", 余堀り: "よぼり", 鋤取り: "すきとり",
  三大災害: "さんだいさいがい", 監理技術者: "かんりぎじゅつしゃ", 主任技術者: "しゅにんぎじゅつしゃ", 現場代理人: "げんばだいりにん",
  指差し呼称: "ゆびさしこしょう", 指差呼称: "ゆびさしこしょう", 危険予知: "きけんよち", 送り出し教育: "おくりだしきょういく", 新規入場者: "しんきにゅうじょうしゃ",
  労災: "ろうさい", 有給: "ゆうきゅう", 割増: "わりまし", 解雇: "かいこ", 賃金: "ちんぎん", 雇用: "こよう", 産業廃棄物: "さんぎょうはいきぶつ",
  建ぺい率: "けんぺいりつ", 容積率: "ようせきりつ", 航空障害灯: "こうくうしょうがいとう", 中和: "ちゅうわ", 揚水: "ようすい",
  凡例: "はんれい", 出来ばえ: "できばえ", 出来形: "できがた", 刃: "は", 研ぐ: "とぐ", 一人親方: "ひとりおやかた", 親方: "おやかた", 棟梁: "とうりょう",
  人時売上高: "にんじうりあげだか", 食中毒: "しょくちゅうどく", 次亜塩素酸: "じあえんそさん", 解凍: "かいとう", 賞味期限: "しょうみきげん", 消費期限: "しょうひきげん",
  主賓: "しゅひん", 会釈: "えしゃく", 口角: "こうかく", 原価: "げんか", 棚卸: "たなおろし", 発注: "はっちゅう", 歩留まり: "ぶどまり", 仕込み: "しこみ",
  "何℃": "なん℃", 何m: "なんm", 何時: "なんじ", 何日: "なんにち", 何分: "なんぷん", 何回: "なんかい", 何年: "なんねん", 何段階: "なんだんかい",
  // 読みのまちがいを直したときに足した語（介護・建設・外食・ふだんの語）
  日本人: "にほんじん", 何時間: "なんじかん", 一日中: "いちにちじゅう", 今日中: "きょうじゅう", 大勢: "おおぜい", 分別: "ぶんべつ", 鶏肉: "とりにく", 棚卸し: "たなおろし",
  口腔: "こうくう", 嚥下: "えんげ", 誤嚥: "ごえん", 褥瘡: "じょくそう", 清拭: "せいしき", 健側: "けんそく", 患側: "かんそく", 片麻痺: "かたまひ", 見当識: "けんとうしき", 脱健着患: "だっけんちゃっかん",
  配筋: "はいきん", 主筋: "しゅきん", 帯筋: "おびきん", 細骨材: "さいこつざい", 粗骨材: "そこつざい", 鋼製: "こうせい", 墨出し器: "すみだしき", 生コン車: "なまコンしゃ", 中塗り: "なかぬり", 打設中: "だせつちゅう",
  令和: "れいわ", 届出: "とどけで", 名乗: "なの", 粗利益: "あらりえき", 粗利: "あらり", 唐揚げ: "からあげ", 出刃: "でば", 一尾魚: "いちびざかな", 和種: "わしゅ", 庫内: "こない", 下処理: "したしょり", 柵: "さく", 来られる: "こられる", 褐毛: "あかげ",
  床筋: "ゆかきん", 腰墨: "こしずみ", 水墨: "みずずみ", 水平墨: "すいへいずみ", 圧接: "あっせつ", 建込み: "たてこみ", 天板: "てんいた", 翌日: "よくじつ", 心停止: "しんていし", 辞書形: "じしょけい", 可能形: "かのうけい", 技能力: "ぎのうりょく", 褐変: "かっぺん", 貯氷: "ちょひょう", 吹付け: "ふきつけ",
  何と: "なんと", 辛い: "からい", 辛く: "からく", "に 入れなくて": "に はいれなくて", 明細: "めいさい", 家賃: "やちん", 交番: "こうばん", 花火大会: "はなびたいかい", 何です: "なんです", 日本語: "にほんご", 日本: "にほん", きつえん所: "きつえんじょ", 事務所: "じむしょ", が開く: "があく", が開いて: "があいて", 結着: "けっちゃく", 梁: "はり", 人時: "にんじ", 小梁: "こばり", 大梁: "おおばり", 年次: "ねんじ", 日曜日: "にちようび", 今日: "きょう", 一度: "いちど", 二人: "ふたり", 一人: "ひとり", 上手: "じょうず", 大人: "おとな", 下手: "へた",
};
const TERM_KEYS = Object.keys(TERMS).sort((a, b) => b.length - a.length);
const KANJI = /[一-龯々〆ヶ]/;
const kata2hira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

// 語の表記（漢字とかなのまじり）と読み（ひらがな）を合わせて、漢字の部分にだけ読みを付ける
function align(surface, reading) {
  const parts = surface.match(/[一-龯々〆ヶ]+|[^一-龯々〆ヶ]+/g);
  const re = new RegExp("^" + parts.map(p => KANJI.test(p) ? "(.+?)" : kata2hira(p).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("") + "$");
  const m = kata2hira(reading).match(re);
  if (!m) return null;
  let k = 1;
  return parts.map(p => KANJI.test(p) ? `｜${p}(${m[k++]})` : p).join("");   // ｜で読みの範囲をはっきりさせる（前の漢字とくっつかないように）
}

const tokenizer = await new Promise((ok, ng) => kuromoji.builder({ dicPath: "node_modules/kuromoji/dict" }).build((e, t) => e ? ng(e) : ok(t)));
function ruby(text) {
  let out = "", i = 0, rest = "";
  const flush = () => {
    if (!rest) return;
    for (const tk of tokenizer.tokenize(rest)) {
      const s = tk.surface_form;
      if (!KANJI.test(s) || !tk.reading || tk.reading === "*") { out += s; continue; }
      out += align(s, tk.reading) || s;
    }
    rest = "";
  };
  while (i < text.length) {
    const key = TERM_KEYS.find(k => text.startsWith(k, i));
    if (key) { flush(); out += align(key, TERMS[key]) || key; i += key.length; }
    else { rest += text[i]; i++; }
  }
  flush();
  // 数字のすぐあとの漢字（助数詞）は、数字ごとにまとめないと読みが変わるので、ここではふりがなを付けない
  out = out.replace(/([にへ]\s?)｜行\(おこな\)っ/g, "$1｜行(い)っ");   // 「病院に 行って」は「いって」
  out = out.replace(/｜語\(かたり\)/g, "｜語(ご)");   // 「語の意味」などの「語」は「ご」
  out = out.replace(/｜年\(とし\)(?=[0-9０-９])/g, "｜年(ねん)");   // 「年5日」などは「ねん」
  return out.replace(/([0-9０-９])｜([一-龯々〆ヶ]+)\(([ぁ-んー]+)\)/g, "$1$2");
}

const i18nSrc = fs.readFileSync("i18n.js", "utf8");
const uiJa = [...i18nSrc.matchAll(/\bja:\s*"((?:[^"\\]|\\.)*)"/g)].map(m => JSON.parse(`"${m[1]}"`));
const texts = new Set();
const add = s => { if (typeof s === "string" && KANJI.test(s)) texts.add(s); };
uiJa.forEach(add);
for (const sc of SCENES) { add(sc.title_ja); add(sc.goal_ja); (sc.hints || []).forEach(add); }
for (const s of Object.values(SITUATIONS)) { add(s.you.ja); add(s.now.ja); s.todo.forEach(x => add(x.ja)); }
for (const d of DRILLS) add(d.speaker);
vocabTexts().forEach(add);
for (const q of EXAMS) {
  add(q.section); add(q.explain_ja);
  if (!q.question_furigana) add(q.question_ja);
  // 漢字・読み・表記・用法・語彙の問題の選択肢は、画面でふりがなを出さない（app.js の choiceRuby と同じ）ので作らない
  if (q.choices && !q.term && !/漢字|表記|読み|用法|語彙/.test(q.section || "")) q.choices.forEach(add);
  if (q.answer_text) add(q.answer_text);
}

const OUT = "ruby.js";
const old = JSON.parse(fs.readFileSync(OUT, "utf8").replace(/^[\s\S]*?export const RUBY = /, "").replace(/;\s*$/, ""));
const todo = [...texts].filter(t => !(t in old));
const result = { ...old };
const strip = s => s.replace(/｜/g, "").replace(/\(([ぁ-んー]+)\)/g, "");
let n = 0;
for (const t of todo) {
  if (/[()]/.test(t)) continue;   // 元の文に半角かっこがあると、読みと区別できない
  const r = fixRuby(t, ruby(t));   // 文の前後で決まる読みを ruby_fixes.mjs で直す
  if (strip(r) === t && /\([ぁ-んー]+\)/.test(r)) { result[t] = r; n++; }
}
fs.writeFileSync(OUT, `// 画面の日本語のふりがな（make_ruby.mjs で作る。手で直してもよい）。キー＝元の文、値＝「漢字(よみ)」の形\nexport const RUBY = ${JSON.stringify(result, null, 0)};\n`);
console.log(`新しく ${todo.length} 文のうち ${n} 文に ふりがなを付けた`);
