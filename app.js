import { t, tja, getLang, setLang } from "./i18n.js";
import { SCENES } from "./scenes.js";
import { SITUATIONS } from "./situations.js";
import { SAFETY_RULES, mask } from "./safety.js";
import { startConversation, stopConversation, sendNote, liveSpeak, LIVE_MODEL } from "./live.js";
import { makeFeedback, judgeRetry, judgeDrill, makeScaffold, tts, TEXT_MODEL } from "./coach.js";
import { DRILLS, DRILL_INDUSTRIES } from "./drills.js";
import { EXAMS } from "./exams.js";
import * as S from "./store.js";
import { autoSetup, preloadGis } from "./setup.js";

const CONSENT_VERSION = "trial-2026-10-v2";   // v2: 音声入力（ブラウザの音声認識）の送り先を説明に追加
const MAX_SECONDS = 300;                       // 1場面は最長5分（原価を抑えるため）
const YEN = 150;                               // 1ドル＝150円で試算
// 料金（1ドル単位・100万トークンあたり）。原価の実測用の目安。正式な単価は料金表で再確認する
const PRICE = { liveAudioIn: 3, liveAudioOut: 12, liveTextIn: 0.75, liveTextOut: 4.5, textIn: 0.3, textOut: 2.5 };

const $app = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const L = () => getLang();
// 選んだ言語の文と、日本語の文を並べる（日本語を読む練習にもなるように）
const bi = k => L() === "ja" ? esc(t(k)) : `${esc(t(k))}<span class="ja">${esc(tja(k))}</span>`;
const sceneTitle = sc => L() === "ja" ? sc.title_ja : sc.title?.[L()] || sc.title_ja;
const sceneGoal = sc => L() === "ja" ? sc.goal_ja : sc.goal?.[L()] || sc.goal_ja;

function show(html) {
  $app.innerHTML = html; window.scrollTo(0, 0);
  $app.querySelectorAll("[data-say]").forEach(b => b.onclick = () => say(b.dataset.say));
}

// お手本の声。キーがあればAIの自然な声（一度作った声は使い回す）、なければスマホの読み上げ
const sayCache = new Map();
let sayCtx = null;
async function say(text) {
  // 短い言葉（用語カードなど）は、AIの声だと発音が崩れたり説明をしゃべったりするので、スマホの読み上げで読む
  if (text.replace(/[。、！？\s]/g, "").length <= 10) { sayLocal(text); return; }
  if (S.getKey() && !ttsBroken) {
    try {
      sayCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      await sayCtx.resume();
      if (!sayCache.has(text)) {
        const a = await liveSpeak(S.getKey(), text, { style: "日本語の先生が、はっきり自然に" });
        let buf;
        if (a.isWav) buf = await sayCtx.decodeAudioData(a.bytes.buffer.slice(0));
        else {
          const n = a.bytes.length >> 1; buf = sayCtx.createBuffer(1, n, a.rate);
          const ch = buf.getChannelData(0), dv = new DataView(a.bytes.buffer);
          for (let i = 0; i < n; i++) ch[i] = dv.getInt16(i * 2, true) / 0x8000;
        }
        sayCache.set(text, buf);
      }
      const src = sayCtx.createBufferSource(); src.buffer = sayCache.get(text); src.connect(sayCtx.destination); src.start();
      return;
    } catch (e) { console.warn("TTS fallback", e); ttsBroken = true; return; }   // 次に押したときからスマホの読み上げ
  }
  sayLocal(text);
}
function sayLocal(text) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = "ja-JP"; u.rate = 0.85;
  const v = speechSynthesis.getVoices().find(v => v.lang === "ja-JP"); if (v) u.voice = v;
  speechSynthesis.speak(u);
}
const sayBtn = text => `<button class="say" data-say="${esc(text)}" aria-label="listen">🔊</button>`;

// ───── 初回設定 ─────
function renderSetup() {
  const p = S.getProfile() || {};
  show(`
    <h1>${bi("appName")}</h1>
    <section class="card">
      <h2>${bi("chooseLang")}</h2>
      <div class="row">
        ${[["ja", "日本語"], ["en", "English"], ["vi", "Tiếng Việt"]].map(([v, n]) =>
          `<button class="choice ${L() === v ? "on" : ""}" data-lang="${v}">${n}</button>`).join("")}
      </div>
    </section>
    <section class="card">
      <label>${bi("nickname")}<input id="nick" value="${esc(p.nickname || "")}" placeholder="${esc(t("nicknameHint"))}" maxlength="20"></label>
    </section>
    <section class="card">
      <h2>${bi("consentTitle")}</h2>
      <p>${esc(t("consentBody"))}</p>
      ${L() !== "ja" ? `<p class="ja">${esc(tja("consentBody"))}</p>` : ""}
      <label class="check"><input type="checkbox" id="age18"> ${bi("age18")}</label>
      <label class="check"><input type="checkbox" id="agree"> ${bi("agreeCheck")}</label>
      <button id="go" class="primary" disabled>${bi("agree")}</button>
    </section>`);
  $app.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { setLang(b.dataset.lang); renderSetup(); });
  const chk = () => { document.getElementById("go").disabled = !(age18.checked && agree.checked && nick.value.trim()); };
  const age18 = document.getElementById("age18"), agree = document.getElementById("agree"), nick = document.getElementById("nick");
  [age18, agree].forEach(e => e.onchange = chk); nick.oninput = chk;
  document.getElementById("go").onclick = () => {
    S.setProfile({ nickname: nick.value.trim(), lang: L(), consent: { version: CONSENT_VERSION, at: new Date().toISOString(), age18: true } });
    renderHome();   // 設定画面には飛ばさない（テストで「開発者向けの画面に飛ばされてやめる」と指摘）
  };
}

// 業種：アイコン＋日本語（ふりがな）＋母語
const INDUSTRY = {
  "工場": { icon: "🏭", furi: "こうじょう", en: "Factory", vi: "Nhà máy" },
  "建設": { icon: "🏗️", furi: "けんせつ", en: "Construction", vi: "Xây dựng" },
  "介護": { icon: "🧓", furi: "かいご", en: "Care work", vi: "Chăm sóc (Kaigo)" },
  "旅館・ホテル": { icon: "🏨", furi: "りょかん・ほてる", en: "Hotel / Ryokan", vi: "Khách sạn / Ryokan" },
  "飲食": { icon: "🍽️", furi: "いんしょく", en: "Restaurant", vi: "Nhà hàng" },
};
function industryLabel(i) {
  const x = INDUSTRY[i] || { icon: "", furi: "" };
  return `<span class="indicon">${x.icon}</span><ruby>${esc(i)}<rt>${esc(x.furi)}</rt></ruby>${L() !== "ja" && x[L()] ? `<small>${esc(x[L()])}</small>` : ""}`;
}

// AIの準備（キー）がまだのとき：開発者向けの設定画面に飛ばさず、やさしく説明して、すぐできる練習へ案内する
function renderNeedSetup() {
  show(`
    <button class="back link">← ${esc(t("home"))}</button>
    <section class="card goal">
      <h2>🔒 ${bi("needSetupTitle")}</h2>
      <p>${bi("needSetupBody")}</p>
    </section>
    <button id="goDrill" class="primary">👂 ${bi("drillTitle")}</button>
    <button id="goExam" class="primary">📝 ${bi("examTitle")}</button>
    <details><summary class="note">${esc(t("forStaff"))}</summary><button id="goSettings" class="sub">⚙ ${esc(t("settings"))}</button></details>`);
  $app.querySelector(".back").onclick = renderHome;
  document.getElementById("goDrill").onclick = () => renderDrill(DRILLS.filter(d => d.industry === DRILL_INDUSTRIES[0]), 0);
  document.getElementById("goExam").onclick = () => startExam(EXAM_SETS[0]);
  document.getElementById("goSettings").onclick = renderSettings;
}

// ───── ホーム ─────
function renderHome() {
  const due = S.dueCards().length;
  const label = { new: "st_new", trying: "st_trying", done: "st_done", fluent: "st_fluent" };
  show(`
    <header class="top"><h1>${bi("appName")}</h1><button id="settings" class="sub settingsbtn" aria-label="settings">⚙ ${esc(t("settingsShort"))}</button></header>
    <section class="stats">
      <div><b>${S.practiceDays()}</b><small>${bi("daysPracticed")}</small></div>
      <button id="review" class="statbtn ${due ? "due" : ""}"><b>${due}</b><small>${bi("reviewToday")}</small></button>
    </section>
    <section class="card drillentry">
      <h2>👂 ${bi("drillTitle")}</h2>
      <p class="note">${esc(t("drillNote"))}</p>
      <div class="row">${DRILL_INDUSTRIES.map(i => `<button class="choice ind" data-ind="${esc(i)}">${industryLabel(i)}</button>`).join("")}</div>
    </section>
    <section class="card">
      <h2>📝 ${bi("examTitle")}</h2>
      <div class="row">${EXAM_SETS.map((s, i) => s.group ? "" : `<button class="choice" data-exam="${i}">${esc(s.name)}</button>`).join("")}</div>
      <p class="note">${esc(t("examGroup2"))}</p>
      <div class="row">${EXAM_SETS.map((s, i) => s.group ? `<button class="choice" data-exam="${i}">${esc(s.name)}</button>` : "").join("")}</div>
      <p class="note">${esc(t("examNote"))}</p>
    </section>
    <h2>${bi("scenes")}</h2>
    ${SCENES.map(sc => {
      const st = S.sceneStatus(sc.id);
      return `<button class="scene" data-id="${sc.id}">
        <span class="badge ${st}">${esc(t(label[st]))}</span>
        <span class="title">${esc(sceneTitle(sc))}</span>
        ${L() !== "ja" ? `<span class="ja">${esc(sc.title_ja)}</span>` : ""}
        <span class="level">${esc(sc.level)}</span>
      </button>`;
    }).join("")}
    <p class="note">${bi("aiNote")}</p>`);
  $app.querySelectorAll(".scene").forEach(b => b.onclick = () => renderPrep(SCENES.find(s => s.id === b.dataset.id)));
  $app.querySelectorAll("[data-ind]").forEach(b => b.onclick = () => renderDrill(DRILLS.filter(d => d.industry === b.dataset.ind), 0));
  $app.querySelectorAll("[data-exam]").forEach(b => b.onclick = () => startExam(EXAM_SETS[+b.dataset.exam]));
  document.getElementById("review").onclick = renderReview;
  document.getElementById("settings").onclick = renderSettings;
}

// ───── 準備 ─────
function phraseHtml(p) {
  const furi = S.getFurigana();
  const tr = L() === "ja" ? p.en : p[L()] || p.en;
  return `<li class="phrase">${sayBtn(p.furigana || p.ja)}<span class="jp">${esc(p.ja)}</span>
    ${furi ? `<span class="furi">${esc(p.furigana)}</span>` : ""}
    <span class="tr">${esc(tr)}</span></li>`;
}

// 状況カード：自分の立場・いま起きていること・伝えること。準備画面と会話中の両方に出す
const loc = o => L() === "ja" ? o.ja : o[L()] || o.en;
function situationHtml(sc, compact = false, hideTodo = false) {
  const s = SITUATIONS[sc.id];
  if (!s) return "";
  const both = o => `${esc(loc(o))}${L() !== "ja" ? `<span class="ja">${esc(o.ja)}</span>` : ""}`;
  return `<section class="card situation">
    ${compact ? "" : `<h2>${bi("situation")}</h2><p>${both(s.you)}</p>`}
    <p class="${compact ? "" : "big"}">${both(s.now)}</p>
    ${hideTodo ? "" : `<h2>${bi("todo")}</h2>
    <ol class="todo">${s.todo.map(x => `<li>${both(x)}</li>`).join("")}</ol>`}
  </section>`;
}

// ───── 手助けの段階（2=えらぶ 3=うめる 4=キーワード 5=カードだけ） ─────
const LEVELS = [{ n: 2, k: "lvChoose" }, { n: 3, k: "lvFill" }, { n: 4, k: "lvKey" }, { n: 5, k: "lvCard" }];
const recommendLevel = sc => ({ new: 2, trying: 3, done: 4, fluent: 5 }[S.sceneStatus(sc.id)]);
const getLevel = sc => +localStorage.getItem("nk.level." + sc.id) || recommendLevel(sc);
const setLevel = (sc, n) => localStorage.setItem("nk.level." + sc.id, n);

// 手助けの材料はAIで作り、場面ごと・言語ごとに端末へ保存して使い回す（毎回作ると原価がかかるため）
const scafPending = {};
function loadScaffold(sc) {
  const ck = `nk.scaf.${sc.id}.${L()}`;
  try { const c = JSON.parse(localStorage.getItem(ck)); if (c?.steps?.length) return Promise.resolve(c); } catch {}
  if (!S.getKey() || !SITUATIONS[sc.id]) return Promise.resolve(null);
  return scafPending[ck] ||= makeScaffold(S.getKey(), sc, SITUATIONS[sc.id], L())
    .then(r => { localStorage.setItem(ck, JSON.stringify(r.result)); return r.result; })
    .catch(e => { console.error(e); delete scafPending[ck]; return null; });
}

function supportHtml(scaf, level) {
  if (level >= 5 || !scaf) return "";
  return `<section class="card support"><h2>${bi(LEVELS.find(x => x.n === level).k)}</h2><ol class="steps">${scaf.steps.map((st, i) => {
    if (level === 2) {
      const opts = [st.full, ...st.wrong.slice(0, 2)].sort(() => Math.random() - .5);
      return `<li>${opts.map(o => `<button class="opt" data-step="${i}" data-ok="${o === st.full ? 1 : 0}">${esc(o)}</button>`).join("")}
        <span class="optres" id="optres${i}"></span></li>`;
    }
    const body = level === 3 ? `<span class="jp">${esc(st.skeleton)}</span>`
      : `<span class="kw">${st.keywords.map(k => `<span class="chip">${esc(k)}</span>`).join("")}</span>`;
    return `<li>${body}<details><summary class="note">${esc(t("showAnswer"))}</summary>
      <span class="jp">${sayBtn(st.furigana || st.full)}${esc(st.full)}</span>${S.getFurigana() ? `<span class="furi">${esc(st.furigana)}</span>` : ""}<span class="tr">${esc(st.meaning)}</span></details></li>`;
  }).join("")}</ol></section>`;
}

function wireSupport(scaf) {
  $app.querySelectorAll(".opt").forEach(b => b.onclick = () => {
    const i = +b.dataset.step, st = scaf.steps[i];
    $app.querySelectorAll(`.opt[data-step="${i}"]`).forEach(x => x.classList.toggle("right", x.dataset.ok === "1"));
    if (b.dataset.ok !== "1") b.classList.add("wrong");
    const r = document.getElementById("optres" + i);
    r.innerHTML = `${b.dataset.ok === "1" ? "✅" : "🔁"} ${S.getFurigana() ? `<span class="furi">${esc(st.furigana)}</span>` : ""}<span class="tr">${esc(st.meaning)}</span>`;
  });
  $app.querySelectorAll(".support [data-say]").forEach(b => b.onclick = () => say(b.dataset.say));
}

function renderPrep(sc) {
  loadScaffold(sc);   // 会話を始める前に、手助けの材料を先に作っておく
  const lv = getLevel(sc), rec = recommendLevel(sc);
  show(`
    <button class="back link">← ${esc(t("home"))}</button>
    <h1>${esc(sceneTitle(sc))}</h1>
    <section class="card goal">
      <h2>${bi("todayGoal")}</h2>
      <p class="big">${esc(sceneGoal(sc))}</p>
      ${L() !== "ja" ? `<p class="ja">${esc(sc.goal_ja)}</p>` : ""}
    </section>
    ${situationHtml(sc)}
    <section class="card">
      <div class="row between"><h2>${bi("phrases")}</h2>
        <label class="toggle"><input type="checkbox" id="furi" ${S.getFurigana() ? "checked" : ""}> ${esc(t("furigana"))}</label></div>
      <ul class="phrases">${sc.key_phrases.map(phraseHtml).join("")}</ul>
    </section>
    <section class="card">
      <h2>${bi("levelTitle")}</h2>
      <div class="levels">${LEVELS.map(x => `<button class="choice lv ${x.n === lv ? "on" : ""}" data-lv="${x.n}">${esc(t(x.k))}${x.n === rec ? `<small>★${esc(t("recommended"))}</small>` : ""}</button>`).join("")}</div>
      <p class="note">${esc(t(LEVELS.find(x => x.n === lv).k + "Note"))}</p>
    </section>
    <div class="stickybar"><button id="start" class="primary big">${S.getKey() ? "" : "🔒 "}${bi("start")}</button></div>`);
  $app.querySelector(".back").onclick = renderHome;
  $app.querySelectorAll("[data-lv]").forEach(b => b.onclick = () => { setLevel(sc, +b.dataset.lv); renderPrep(sc); });
  document.getElementById("furi").onchange = e => { S.setFurigana(e.target.checked); renderPrep(sc); };
  document.getElementById("start").onclick = () => renderTalk(sc);
}

// ───── 本番の会話 ─────
function systemFor(sc, level) {
  const nick = S.getProfile()?.nickname || "学習者";
  const levelRule = {
    2: "学習者は画面の3つの候補から文を選んで言う、いちばんやさしい段階。とてもゆっくり、短く話し、「やること」の順番どおりに会話を進める。予想外の質問はしない。",
    3: "学習者は画面の穴うめの文を見ながら話す段階。ゆっくり話し、「やること」の順番どおりに進める。",
    4: "学習者はキーワードだけを見て自分で文を作る段階。ふつうより少しゆっくり話す。言い方を少し変えたり、質問を1つ足したりしてよい。",
    5: "学習者は状況カードだけで話すいちばん上の段階。ふつうの速さで話す。途中で、状況に合った予想外のこと（例：「今、手が離せない」「その時間だと困る」）を1つだけ混ぜる。",
  }[level] || "";
  const s = SITUATIONS[sc.id];
  const langName = { ja: "やさしい日本語", en: "英語", vi: "ベトナム語" }[L()] || "英語";
  return `${SAFETY_RULES}

# 練習の内容
これは外国人の日本語学習者（目安 ${sc.level}）との、職場・生活の会話練習（ロールプレイ）です。
あなたの役: ${sc.ai_role}
学習者の練習用の名前: ${nick}（本名ではない）
今日の目標: ${sc.goal_ja}
${s ? `学習者に見せている状況: ${s.you.ja} ${s.now.ja}
学習者がやること（順番の目安）: ${s.todo.map((x, i) => `${i + 1}. ${x.ja}`).join(" / ")}
この状況の設定（人名・時間・数字）に合わせて会話する。学習者に見せていない設定を勝手に増やさない。` : ""}
この場面の注意: ${sc.safety_note}

# 場面から外れたとき（先生として短く指摘する）
- 学習者が、この場面・状況と関係ないこと、状況と合わないこと（例：遅刻の電話なのに雑談を始める、店員なのに自分が客のように話す、状況と違う時間や理由を言う）を言ったら、役をいったん止めて「（せんせい）今は${sc.title_ja.replace(/^.*?：/, "")}の場面です。〜を言いましょう。」のように、次にやることを1つだけ短く伝える。そのあと「では、もう一度。」と言って、すぐに役に戻る。
- 学習者が何を言えばいいか分からず黙ったり「わからない」と言ったら、まだできていない「やること」の次の1つを、やさしい日本語で短く教える。2回目も伝わらなければ${langName}で一言だけ説明する。

# 日本語の間違いを、その場で直す（先生として短く）
- はっきりした日本語の間違いは、聞き流さずに、その発言のすぐあとで直す。例：「あるです」「あるですます」「行くです」「食べるでした」（動詞に「です」を付ける）、動詞・形容詞の形の間違い（「痛いがあります」「止めるました」）、助詞の大きな間違い、上司やお客様へのていねいさの間違い（「わかった」「ちょっと待って」）。
- 直し方：役をいったん止めて「（せんせい）『〇〇』ですね。もう一度 言ってみましょう。」と、正しい言い方を1つだけ短く言う。学習者が言い直したら「いいですね。」と言って、すぐ役に戻る。
- 1回の発言で直すのは1つだけ。いちばん大事な間違いを選ぶ。言い直しがうまくいかなくても、2回目で役に戻る（責めない）。
- 文字起こしの誤認識らしいもの（意味は通じる言いよどみ・言い直し）は直さない。

# 読み方（発音をまちがえない）
- この場面のお手本の文と、その読み方。この読み方で発音する：
${sc.key_phrases.map(p => `  ${p.ja} → ${p.furigana}`).join("\n")}
- まちがえやすい読み：薬＝くすり（「やく」ではない）、〇番＝〇ばん、〇卓＝〇たく、37度5分＝さんじゅうななどごぶ、9時半＝くじはん、10分＝じゅっぷん、1人＝ひとり、2人＝ふたり、〇日＝ついたち・ふつか・みっか…（日付は正しく）、何時＝なんじ、上手＝じょうず、下手＝へた、今日＝きょう、明日＝あした。
- 読み方に自信がない漢字の言葉は、使わずに、やさしい言葉に言いかえる。

# 今回の手助けの段階
${levelRule}

# 話し方
- 日本語だけで話す。学習者に合わせて、短い文で、少しゆっくり話す。1回に1つだけ質問する。
- 意味が分からないときは、役のまま自然に聞き返す。
- 目標が達成されたら、役として自然に会話を終える。
- 最初の一言は「${sc.opening_line}」。
- 丸かっこ（ ）の中の文は、学習者が画面のボタンを押した合図。声に出して読まず、その指示に従う。`;
}

function renderTalk(sc) {
  const key = S.getKey();
  if (!key) { renderNeedSetup(); return; }
  const transcript = [];          // { who, text }
  const usage = [];               // Live の usageMetadata（原価の実測用）
  let hintIdx = 0, timer = null, finished = false;
  const level = getLevel(sc);
  show(`
    <div class="talk">
      <div class="row between"><h1>${esc(sceneTitle(sc))}</h1><span id="clock" class="clock">5:00</span></div>
      <div id="turn" class="turn wait"><span class="icon">⏳</span>${esc(t("connecting"))}</div>
      <p id="status" class="status note">${esc(t("connecting"))}</p>
      <div class="meter"><div id="level"></div></div>
      <details class="sitbox" open><summary>${esc(t("situation"))}${level < 5 ? "・" + esc(t("todo")) : ""}</summary>${situationHtml(sc, true, level >= 5)}</details>
      <div id="support"></div>
      <div id="log" class="log"></div>
      <p id="hintText" class="hinttext" hidden></p>
      <div class="row">
        <button id="hint" class="sub">💡 ${esc(t("hint"))}</button>
        <button id="slow" class="sub">🐢 ${esc(t("slower"))}</button>
      </div>
      <form id="typeForm" class="row"><input id="typeBox" placeholder="${esc(t("typeHere"))}"><button class="sub">${esc(t("send"))}</button></form>
      <button id="end" class="primary">${bi("end")}</button>
    </div>`);
  const $log = document.getElementById("log"), $status = document.getElementById("status");
  const add = (who, text) => {
    const last = transcript[transcript.length - 1];
    if (last && last.who === who && !last.done) last.text += text; else transcript.push({ who, text, done: false });
    $log.innerHTML = transcript.filter(m => m.text.trim()).map(m =>
      `<p class="msg ${m.who}">${esc(m.who === "me" ? mask(m.text) : m.text)}</p>`).join("");
    $log.scrollTop = $log.scrollHeight;
  };
  const statusText = { listening: "connected", "mic-denied": "micDenied", "time-up": "timeUp", closed: "error" };
  loadScaffold(sc).then(scaf => {
    const $s = document.getElementById("support");
    if ($s && scaf) { $s.innerHTML = supportHtml(scaf, level); wireSupport(scaf); }
  });

  startConversation({
    key, systemText: systemFor(sc, level),
    openingText: "（練習を始めます。あなたの最初の一言から話してください）",
    onText: (who, text, done) => {
      if (text) add(who, text);
      if (done) { for (const m of transcript) m.done = true; }
      // 学習者が話し始めたら、直前のAIの発言は区切る
      if (who === "me") { const prev = transcript[transcript.length - 2]; if (prev) prev.done = true; }
    },
    onStatus: (s, isErr, detail) => {
      $status.textContent = t(statusText[s] || s) + (detail ? ` (${detail})` : ""); $status.classList.toggle("err", !!isErr);
      if (s === "listening" && !timer) startTimer();           // 5分は、つながって話せる状態になってから数える
      if (s === "mic-denied") { finished = true; clearInterval(timer); }
    },
    onUsage: u => usage.push(u),
    onClose: () => finish(),
    // 今だれが話す番かを、大きく色分けして出す（「話していいのか分からない」への対応）
    onTurn: s => {
      const $t = document.getElementById("turn"); if (!$t) return;
      $t.className = "turn " + s;
      const icon = { wait: "⏳", ai: "🔊", you: "🎙️", hearing: "👂" }[s];
      $t.innerHTML = `<span class="icon">${icon}</span>` + bi({ wait: "turnWait", ai: "turnAi", you: "turnYou", hearing: "turnHearing" }[s]);
      if (s === "you") try { navigator.vibrate?.(120); } catch {}   // Androidは短く震えて知らせる
    },
    onLevel: v => { const $l = document.getElementById("level"); if ($l) $l.style.width = Math.round(v * 100) + "%"; },
  });

  let left = MAX_SECONDS;
  function startTimer() {
    timer = setInterval(() => {
      left--;
      const $c = document.getElementById("clock");
      if ($c) $c.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      if (left <= 0) finish();
    }, 1000);
  }

  document.getElementById("hint").onclick = () => {
    const h = document.getElementById("hintText");
    h.hidden = false; h.textContent = sc.hints[hintIdx % sc.hints.length]; hintIdx++;
  };
  document.getElementById("slow").onclick = () => sendNote("（学習者が「ゆっくり」を押しました。これからは、もっとゆっくり、短い文で話してください）");
  document.getElementById("typeForm").onsubmit = e => {
    e.preventDefault();
    const box = document.getElementById("typeBox"), v = box.value.trim();
    if (!v) return;
    add("me", v); transcript[transcript.length - 1].done = true;
    sendNote(v); box.value = "";
  };
  document.getElementById("end").onclick = () => finish();

  async function finish() {
    if (finished) return; finished = true;
    clearInterval(timer);
    const seconds = stopConversation();
    const clean = transcript.filter(m => m.text.trim()).map(m => ({ who: m.who, text: m.who === "me" ? mask(m.text) : m.text }));
    renderFeedback(sc, clean, seconds, usage);
  }
}

// ───── 直し ─────
async function renderFeedback(sc, transcript, seconds, liveUsage) {
  show(`<p class="status">${esc(t("checking"))}</p>`);
  let fb = null, textUsage = {}, failed = false;
  const spoke = transcript.some(m => m.who === "me");
  try {
    if (spoke) {
      const r = await makeFeedback(S.getKey(), sc, transcript, L());
      fb = r.result; textUsage = r.usage;
    }
  } catch (e) { console.error(e); failed = true; }
  S.addSession({ scene: sc.id, level: getLevel(sc), at: new Date().toISOString(), seconds: Math.round(seconds), transcript, feedback: fb,
    usage: { live: liveUsage, text: textUsage }, models: { live: LIVE_MODEL, text: TEXT_MODEL } });

  if (!fb) {
    show(`<p>${esc(t(failed ? "error" : "noSpeech"))}</p><button class="primary" id="home">${esc(t("home"))}</button>`);
    document.getElementById("home").onclick = renderHome;
    return;
  }
  const f = fb.fix;
  // 直しは言い直しが成功しなくても復習に入れる（苦手な人ほど復習が必要なため）
  if (f.better) S.addCard({ scene: sc.id, better: f.better, better_furigana: f.better_furigana, meaning: f.better_meaning || "" });
  const why = L() === "ja" ? f.why_ja : f.why;
  show(`
    <h1>${bi("result")}</h1>
    <section class="card result ${fb.goal_achieved ? "ok" : ""}">
      <p class="big">${fb.goal_achieved ? "🎉 " + esc(t("goalDone")) : "🙂 " + esc(t("goalAlmost"))}</p>
      <p>${esc(fb.praise)}</p>
    </section>
    <section class="card">
      <h2>${bi("oneFix")}</h2>
      ${f.said ? `<p class="said">${esc(t("youSaid"))}：${esc(f.said)}</p>` : ""}
      <p class="better">${sayBtn(f.better_furigana || f.better)}${esc(t("better"))}：<b>${esc(f.better)}</b></p>
      ${S.getFurigana() ? `<p class="furi">${esc(f.better_furigana)}</p>` : ""}
      <p class="why">${esc(why)}</p>
      ${L() !== "ja" ? `<p class="ja">${esc(f.why_ja)}</p>` : ""}
    </section>
    ${(fb.model_lines || []).length ? `<section class="card">
      <h2>${bi("correctJa")}</h2>
      <ol class="model">${fb.model_lines.map(m => `<li>
        ${m.said ? `<span class="said">${esc(t("youSaid"))}：${esc(m.said)}</span>` : `<span class="said">${esc(t("missing"))}</span>`}
        <span class="jp">${sayBtn(m.furigana || m.correct)}${esc(m.correct)}</span>
        ${S.getFurigana() ? `<span class="furi">${esc(m.furigana)}</span>` : ""}
      </li>`).join("")}</ol>
    </section>` : ""}
    <button id="retry" class="primary big">🎙 ${bi("retry")}</button>
    <button id="home" class="link">${esc(t("home"))}</button>`);
  document.getElementById("home").onclick = renderHome;
  document.getElementById("retry").onclick = () => renderRetry(sc, f);
}

// ───── 言い直し（ブラウザの音声認識。使えない端末では文字で入力） ─────
function listenOnce() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return Promise.resolve(null);
  return new Promise(resolve => {
    const r = new SR(); r.lang = "ja-JP"; r.interimResults = false; r.maxAlternatives = 1;
    let got = "";
    r.onresult = e => { got = e.results[0][0].transcript; };
    r.onerror = () => resolve(got || "");
    r.onend = () => resolve(got);
    r.start();
  });
}

function renderRetry(sc, fix, fromReview = null) {
  show(`
    <button class="back link">← ${esc(t("home"))}</button>
    <h1>${bi("retry")}</h1>
    <p>${bi("retryPrompt")}</p>
    <section class="card">
      <p class="big">${sayBtn(fix.better_furigana || fix.better)}<b>${esc(fix.better)}</b></p>
      ${S.getFurigana() ? `<p class="furi">${esc(fix.better_furigana)}</p>` : ""}
      ${fix.better_meaning ? `<p class="tr">${esc(fix.better_meaning)}</p>` : ""}
    </section>
    <button id="mic" class="primary big">🎙 ${esc(t("speak"))}</button>
    <form id="typeForm" class="row"><input id="typeBox" placeholder="${esc(t("typeHere"))}"><button class="sub">${esc(t("send"))}</button></form>
    <p id="res" class="status"></p>`);
  $app.querySelector(".back").onclick = renderHome;
  const $res = document.getElementById("res");
  let tries = 0;
  const judge = async said => {
    if (!said) { $res.textContent = t("notHeard"); return; }
    $res.textContent = t("checking");
    try {
      const { result } = await judgeRetry(S.getKey(), fix.better, said);
      $res.innerHTML = `${esc(said)}<br><b>${result.ok ? "✅ " + esc(t("great")) : "🔁 " + esc(t("again"))}</b> ${esc(result.comment)}`;
      tries++;
      if (fromReview && (result.ok || tries >= 2)) { S.gradeCard(fromReview, result.ok); setTimeout(renderReview, 1500); return; }
      if (result.ok || tries >= 2) {   // 2回うまくいかなければ、くり返させずに先へ進める
        $res.insertAdjacentHTML("beforeend", `<br><button class="primary" id="done">${esc(t("home"))}</button>`);
        document.getElementById("done").onclick = renderHome;
      }
    } catch (e) { console.error(e); $res.textContent = t("error"); }
  };
  document.getElementById("mic").onclick = async () => {
    $res.textContent = t("listening");
    const said = await listenOnce();
    if (said === null) { $res.textContent = t("noSR"); document.getElementById("typeBox").focus(); return; }
    judge(said);
  };
  document.getElementById("typeForm").onsubmit = e => { e.preventDefault(); judge(document.getElementById("typeBox").value.trim()); };
}

// ───── 聞いて くりかえす（復唱・聞き返し） ─────
// 指示の文字は最初は隠す（聞き取りの練習）。分からないときは聞き返すのが正解の問題もある
function speak(text, rate) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = "ja-JP"; u.rate = rate;
  const v = speechSynthesis.getVoices().find(v => v.lang === "ja-JP"); if (v) u.voice = v;
  speechSynthesis.speak(u);
}

// 指示はAIの自然な声で流す（スマホの読み上げは機械的で、現場の話し方の練習にならないため）。
// 一度作った声は使い回す。作れないときだけスマホの読み上げにする
const STYLE_PROMPT = {
  "早口": "職場で忙しくしている人が、少し早口で自然に言う",
  "関西弁": "関西の人が、関西弁のイントネーションで自然に言う",
  "方言": "地方のおばあさんが、方言まじりにゆっくり言う",
  "略語": "忙しい飲食店の店長が、早口でぶっきらぼうに言う",
  "あいまい": "忙しそうな人が、軽い口調でさらっと言う",
  "電話": "電話の向こうのお客様が、ていねいに言う",
  "現場のことば": "建設現場の職長が、大きな声ではっきり言う",
};
const audioCache = new Map();
let drillCtx = null;
// AIの声が作れなかったら、以後はスマホの読み上げを「ボタンを押したその場で」使う
// （iPhoneは、押した直後でないと読み上げが鳴らないため、待ってから代わりに鳴らすことはできない）
let ttsBroken = false;
async function playVoice(d, slow) {
  const ck = d.id + (slow ? ":slow" : "");
  const local = () => speak(d.say_kana || d.say, slow ? 0.75 : d.style === "早口" || d.style === "略語" ? 1.3 : 1.1);
  if (ttsBroken || !S.getKey()) { local(); return; }
  const $st = document.getElementById("voiceStatus");
  try {
    if (!audioCache.has(ck) && $st) $st.textContent = t("voiceLoading");
    drillCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    await drillCtx.resume();
    if (!audioCache.has(ck)) {
      const style = slow ? "外国人にもわかるように、とてもゆっくり、はっきり言う" : STYLE_PROMPT[d.style];
      const a = await liveSpeak(S.getKey(), d.say, { style, reading: d.say_kana, voice: d.voice });   // 漢字の文に読み方を添えて、会話と同じAIに読ませる
      let buf;
      if (a.isWav) buf = await drillCtx.decodeAudioData(a.bytes.buffer.slice(0));
      else {
        const n = a.bytes.length >> 1; buf = drillCtx.createBuffer(1, n, a.rate);
        const ch = buf.getChannelData(0), dv = new DataView(a.bytes.buffer);
        for (let i = 0; i < n; i++) ch[i] = dv.getInt16(i * 2, true) / 0x8000;
      }
      audioCache.set(ck, buf);
    }
    const src = drillCtx.createBufferSource(); src.buffer = audioCache.get(ck); src.connect(drillCtx.destination); src.start();
    if ($st) $st.textContent = "";
  } catch (e) {
    console.warn("TTS fallback", e);
    ttsBroken = true;
    if ($st) $st.textContent = t("voiceRetry") + `（${String(e.message).slice(0, 80)}）`;
  }
}

function renderDrill(list, i) {
  if (i >= list.length) { renderHome(); return; }
  const d = list[i];
  const log = { replays: 0, slow: 0, revealed: false };
  show(`
    <button class="back link">← ${esc(t("home"))}</button>
    <h1>👂 ${bi("drillTitle")}（${i + 1}/${list.length}）</h1>
    <section class="card situation">
      <p class="big">🗣 ${esc(d.speaker)}<span class="tag">${esc(d.style)}</span></p>
      <p>${bi("drillTask")}</p>
      <div class="row">
        <button id="play" class="primary">▶ ${esc(t("listen"))}</button>
        <button id="slow" class="sub">🐢 ${esc(t("listenSlow"))}</button>
      </div>
      <p id="voiceStatus" class="note"></p>
      <details id="reveal"><summary class="note">${esc(t("showText"))}</summary><p class="big">${esc(d.say)}</p></details>
      <p class="note">💡 ${esc(t("askTip"))}</p>
    </section>
    <button id="mic" class="primary big">🎙 ${esc(t("speak"))}</button>
    <form id="typeForm" class="row"><input id="typeBox" placeholder="${esc(t("typeHere"))}"><button class="sub">${esc(t("send"))}</button></form>
    <div id="res"></div>`);
  $app.querySelector(".back").onclick = renderHome;
  document.getElementById("play").onclick = () => { log.replays++; playVoice(d, false); };
  document.getElementById("slow").onclick = () => { log.slow++; playVoice(d, true); };
  document.getElementById("reveal").ontoggle = e => { if (e.target.open) log.revealed = true; };
  log.replays++; playVoice(d, false);   // 最初に1回、自動で流す
  const $res = document.getElementById("res");
  const judge = async said => {
    if (!said) { $res.innerHTML = `<p class="status">${esc(t("notHeard"))}</p>`; return; }
    if (!S.getKey()) {   // AIの判定が使えないときは、お手本を見て自分で答え合わせして先へ進める
      $res.innerHTML = `<section class="card"><p class="said">${esc(t("youSaid"))}：${esc(said)}</p>
        <p class="note">${esc(t("selfCheck"))}</p>
        <p class="better">${sayBtn(d.model_kana || d.model)}${esc(t("modelAnswer"))}：<b>${esc(d.model)}</b></p>
        <p class="note">${esc(t("instruction"))}：${esc(d.say)}</p></section>
        <div class="row"><button id="again" class="sub">🔁 ${esc(t("tryAgain"))}</button><button id="next" class="primary">${esc(t("next"))} →</button></div>`;
      $res.querySelectorAll("[data-say]").forEach(b => b.onclick = () => say(b.dataset.say));
      document.getElementById("again").onclick = () => renderDrill(list, i);
      document.getElementById("next").onclick = () => renderDrill(list, i + 1);
      $res.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    $res.innerHTML = `<p class="status">${esc(t("checking"))}</p>`;
    try {
      const { result: r, usage } = await judgeDrill(S.getKey(), d, said, L());
      S.addSession({ type: "drill", drill: d.id, at: new Date().toISOString(), seconds: 0, said, ok: r.ok, checks: r.checks, ...log, usage: { text: usage } });
      $res.innerHTML = `
        <section class="card result ${r.ok ? "ok" : ""}">
          <p class="said">${esc(t("youSaid"))}：${esc(said)}</p>
          <p class="big">${r.ok ? "✅ " + esc(t("great")) : "🔁 " + esc(t("again"))}</p>
          <ul class="checks">${r.checks.map(c => `<li>${c.ok ? "✅" : "⬜"} ${esc(c.item)}</li>`).join("")}</ul>
          <p>${esc(L() === "ja" ? r.comment_ja : r.comment)}</p>
          ${L() !== "ja" ? `<p class="ja">${esc(r.comment_ja)}</p>` : ""}
          <p class="better">${sayBtn(d.model_kana || d.model)}${esc(t("modelAnswer"))}：<b>${esc(d.model)}</b></p>
          <p class="note">${esc(t("instruction"))}：${esc(d.say)}</p>
        </section>
        <div class="row"><button id="again" class="sub">🔁 ${esc(t("tryAgain"))}</button><button id="next" class="primary">${esc(t("next"))} →</button></div>`;
      $res.querySelectorAll("[data-say]").forEach(b => b.onclick = () => say(b.dataset.say));
      document.getElementById("again").onclick = () => renderDrill(list, i);
      document.getElementById("next").onclick = () => renderDrill(list, i + 1);
    } catch (e) { console.error(e); $res.innerHTML = `<p class="status err">${esc(t("error"))}</p>`; }
  };
  document.getElementById("mic").onclick = async () => {
    $res.innerHTML = `<p class="status">${esc(t("listening"))}</p>`;
    const said = await listenOnce();
    if (said === null) { $res.innerHTML = `<p class="status">${esc(t("noSR"))}</p>`; document.getElementById("typeBox").focus(); return; }
    judge(said);
  };
  document.getElementById("typeForm").onsubmit = e => { e.preventDefault(); judge(document.getElementById("typeBox").value.trim()); };
}

// ───── 試験対策（形式に合わせた自作の模擬問題。1回10問） ─────
const EXAM_SETS = [
  { name: "JLPT N4", filter: q => q.exam === "JLPT-N4" },
  { name: "JLPT N3", filter: q => q.exam === "JLPT-N3" },
  { name: "JLPT N2", filter: q => q.exam === "JLPT-N2" },
  { name: "JFT-Basic", filter: q => q.exam === "JFT-Basic" && !q.script },
  { name: "JFT-Basic 聴解", filter: q => q.exam === "JFT-Basic" && !!q.script },
  ...["外食2号", "建設2号", "介護福祉士"].flatMap(f => [
    { name: `一問一答 ${f}`, group: 2, filter: q => q.exam === `一問一答 ${f}` },
    { name: `用語カード ${f}`, group: 2, filter: q => q.exam === `用語カード ${f}` },
  ]),
];
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// 「漢字(よみ)」をふりがな付きの表示に、【語】を下線にする
function examText(q) {
  // 用語カード：語を大きく、ふりがなは語の上に
  if (q.term) return `${esc(t("cardQ"))}<br><span class="term">${S.getFurigana() ? `<ruby>${esc(q.term)}<rt>${esc(q.reading)}</rt></ruby>` : esc(q.term)}</span>`;
  // ふりがなが「全文ひらがな」の問題（一問一答）は、漢字の文の下に、ひらがなの行をそえる
  if (S.getFurigana() && q.question_furigana && !/\([ぁ-ん]/.test(q.question_furigana) && q.question_furigana !== q.question_ja)
    return esc(q.question_ja).replace(/【(.+?)】/g, "<u>$1</u>").replace(/\n/g, "<br>") +
      `<span class="furi">${esc(q.question_furigana.split("\n").slice(1).join(" "))}</span>`;
  const raw = S.getFurigana() ? q.question_furigana : q.question_ja;
  let h = esc(raw).replace(/【(.+?)】/g, "<u>$1</u>");
  // 「｜」があれば、そこから後ろの漢字だけにふりがなを付ける（例：作業｜手順(てじゅん)）。ふりがなOFFでは「｜」を消す
  if (S.getFurigana()) h = h.replace(/(?:｜([一-龯々〆ヶ]+)|([一-龯々〆ヶ]+))\(([ぁ-んー]+)\)/g, (_, a, b, r) => `<ruby>${a || b}<rt>${r}</rt></ruby>`);
  h = h.replace(/｜/g, "");
  return h.replace(/\n/g, "<br>");
}

// 聴解の台本を、話す人ごとに声の高さを変えて読み上げる
function playScript(script) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const v = speechSynthesis.getVoices().find(v => v.lang === "ja-JP");
  for (const line of script.split("\n")) {
    const m = line.match(/^(男|女|店員|客|アナウンス|[^：]{1,6})：(.*)$/);
    const u = new SpeechSynthesisUtterance(m ? m[2] : line);
    u.lang = "ja-JP"; u.rate = 0.95; if (v) u.voice = v;
    u.pitch = m?.[1] === "男" ? 0.7 : m?.[1] === "女" ? 1.3 : 1;
    speechSynthesis.speak(u);
  }
}

function startExam(set) {
  const qs = shuffle(EXAMS.filter(set.filter)).slice(0, 10).map(q => {
    if (!q.choices) return q;   // こたえを見て自分で〇つけする問題（短答・用語カード）
    // 4択は正解の位置が偏らないよう毎回並べかえる。○×はそのまま
    const order = q.choices.length > 2 ? shuffle(q.choices.map((_, i) => i)) : q.choices.map((_, i) => i);
    return { ...q, choicesShown: order.map(i => q.choices[i]), answerShown: order.indexOf(q.answer_index) };
  });
  renderExamQ(set, qs, 0, []);
}

function renderExamQ(set, qs, i, results) {
  if (i >= qs.length) return renderExamResult(set, qs, results);
  const q = qs[i];
  let plays = 0;
  show(`
    <button class="back link">← ${esc(t("home"))}</button>
    <div class="row between"><h1>📝 ${esc(set.name)}（${i + 1}/${qs.length}）</h1>
      <label class="toggle"><input type="checkbox" id="furi" ${S.getFurigana() ? "checked" : ""}> ${esc(t("furigana"))}</label></div>
    <p class="note">${esc(q.section)}</p>
    ${q.script ? `<button id="play" class="primary">▶ ${esc(t("listen"))}（${esc(t("upTo2"))}）</button>` : ""}
    <section class="card"><p class="big exq">${examText(q)}</p>${q.say ? sayBtn(q.say) : ""}</section>
    ${q.choicesShown
      ? `<div class="answers ${q.choicesShown.length === 2 ? "ox" : ""}">${q.choicesShown.map((c, k) => `<button class="ans" data-k="${k}">${q.choicesShown.length > 2 ? k + 1 + ". " : ""}${esc(c)}</button>`).join("")}</div>`
      : `<button id="reveal" class="primary">${esc(t("showAnswer"))}</button>`}
    <div id="res"></div>`);
  $app.querySelectorAll("[data-say]").forEach(b => b.onclick = () => say(b.dataset.say));
  // こたえを見て自分で〇つけする問題
  const $rev = document.getElementById("reveal");
  if ($rev) $rev.onclick = () => {
    $rev.remove();
    const ex = L() === "ja" ? "" : q[`explain_${L()}`] || q.explain_en;
    const $r = document.getElementById("res");
    $r.innerHTML = `<section class="card"><p class="big"><b>${esc(q.answer_text)}</b></p>
        ${ex ? `<p>${esc(ex)}</p>` : ""}<p class="note">${esc(q.explain_ja)}</p></section>
      <div class="row"><button id="selfok" class="sub">✅ ${esc(t("gotIt"))}</button><button id="selfng" class="sub">🔁 ${esc(t("notYet"))}</button></div>`;
    $r.scrollIntoView({ behavior: "smooth", block: "start" });
    const go = ok => { results.push({ id: q.id, ok }); renderExamQ(set, qs, i + 1, results); };
    document.getElementById("selfok").onclick = () => go(true);
    document.getElementById("selfng").onclick = () => go(false);
  };
  $app.querySelector(".back").onclick = renderHome;
  document.getElementById("furi").onchange = e => { S.setFurigana(e.target.checked); renderExamQ(set, qs, i, results); };
  const $play = document.getElementById("play");
  if ($play) $play.onclick = () => { if (plays >= 2) return; plays++; playScript(q.script); if (plays >= 2) $play.disabled = true; };
  $app.querySelectorAll(".ans").forEach(b => b.onclick = () => {
    const k = +b.dataset.k, ok = k === q.answerShown;
    $app.querySelectorAll(".ans").forEach(x => { x.disabled = true; if (+x.dataset.k === q.answerShown) x.classList.add("right"); });
    if (!ok) b.classList.add("wrong");
    results.push({ id: q.id, ok });
    const ex = L() === "ja" ? q.explain_ja : q[`explain_${L()}`] || q.explain_en;
    document.getElementById("res").innerHTML = `
      <section class="card result ${ok ? "ok" : ""}">
        <p class="big">${ok ? "✅ " + esc(t("great")) : "🔁 " + esc(t("examWrong"))}</p>
        <p>${esc(ex)}</p>${L() !== "ja" ? `<p class="ja">${esc(q.explain_ja)}</p>` : ""}
        ${q.script ? `<details><summary class="note">${esc(t("showText"))}</summary><p>${esc(q.script).replace(/\n/g, "<br>")}</p></details>` : ""}
      </section>
      <button id="next" class="primary">${esc(t("next"))} →</button>`;
    document.getElementById("next").onclick = () => renderExamQ(set, qs, i + 1, results);
    document.getElementById("res").scrollIntoView({ behavior: "smooth", block: "start" });   // 解説と「つぎへ」が見えるように
  });
}

function renderExamResult(set, qs, results) {
  const n = results.filter(r => r.ok).length;
  S.addSession({ type: "exam", exam: set.name, at: new Date().toISOString(), seconds: 0, score: n, total: qs.length, results });
  show(`
    <h1>📝 ${esc(set.name)}</h1>
    <section class="card result ${n >= qs.length * 0.7 ? "ok" : ""}"><p class="big">${n} / ${qs.length}</p>
      <p>${esc(t(n >= qs.length * 0.7 ? "examGood" : "examKeep"))}</p></section>
    <button id="again" class="primary">🔁 ${esc(t("examAgain"))}</button>
    <button id="home" class="link">${esc(t("home"))}</button>`);
  document.getElementById("again").onclick = () => startExam(set);
  document.getElementById("home").onclick = renderHome;
}

// ───── 復習 ─────
function renderReview() {
  const cards = S.dueCards();
  if (!cards.length) {
    show(`<h1>${bi("reviewToday")}</h1><p>${bi("noReview")}</p><button class="primary" id="home">${esc(t("home"))}</button>`);
    document.getElementById("home").onclick = renderHome;
    return;
  }
  const c = cards[0];
  show(`
    <button class="back link">← ${esc(t("home"))}</button>
    <h1>${bi("reviewToday")}（${cards.length}）</h1>
    <section class="card"><p>${bi("howToSay")}</p><p class="big">${esc(c.meaning || "…")}</p></section>
    <button id="say" class="primary big">🎙 ${esc(t("speak"))}</button>
    <button id="reveal" class="sub">${esc(t("showAnswer"))}</button>
    <section id="ans" class="card" hidden><p class="big">${sayBtn(c.better_furigana || c.better)}<b>${esc(c.better)}</b></p>
      ${S.getFurigana() ? `<p class="furi">${esc(c.better_furigana)}</p>` : ""}
      <div class="row"><button id="ok" class="sub">✅ ${esc(t("gotIt"))}</button><button id="ng" class="sub">🔁 ${esc(t("notYet"))}</button></div></section>`);
  $app.querySelector(".back").onclick = renderHome;
  document.getElementById("say").onclick = () => renderRetry(null, { better: c.better, better_furigana: c.better_furigana, better_meaning: c.meaning }, c.id);
  document.getElementById("reveal").onclick = () => { document.getElementById("ans").hidden = false; };
  document.getElementById("ok").onclick = () => { S.gradeCard(c.id, true); renderReview(); };
  document.getElementById("ng").onclick = () => { S.gradeCard(c.id, false); renderReview(); };
}

// ───── 設定・記録（開発・試験運用の担当者向け） ─────
function cost(sess) {
  // Live の usageMetadata はターンごとに届く。各回の数を足し合わせる（実測で要確認）
  let usd = 0;
  for (const u of sess.usage?.live || []) {
    for (const d of u.promptTokensDetails || []) usd += d.tokenCount * (d.modality === "AUDIO" ? PRICE.liveAudioIn : PRICE.liveTextIn) / 1e6;
    for (const d of u.responseTokensDetails || []) usd += d.tokenCount * (d.modality === "AUDIO" ? PRICE.liveAudioOut : PRICE.liveTextOut) / 1e6;
  }
  const tu = sess.usage?.text || {};
  usd += (tu.promptTokenCount || 0) * PRICE.textIn / 1e6 + (tu.candidatesTokenCount || 0) * PRICE.textOut / 1e6;
  return usd * YEN;
}

function renderSettings() {
  const sessions = S.getSessions().slice().reverse();
  const totalSec = sessions.reduce((a, s) => a + s.seconds, 0), totalYen = sessions.reduce((a, s) => a + cost(s), 0);
  show(`
    <button class="back link">← ${esc(t("home"))}</button>
    <h1>${esc(t("settings"))}</h1>
    <section class="card ${S.getKey() ? "" : "goal"}">
      <h2>${esc(t("easySetup"))}</h2>
      <p class="note">${esc(t(S.getKey() ? "keyReady" : "easySetupNote"))}</p>
      <button id="auto" class="primary">🔑 ${esc(t("easySetupBtn"))}</button>
      <p id="autoStatus" class="status"></p>
      <details><summary class="note">${esc(t("manualKey"))}</summary>
        <label>${esc(t("devKey"))}<input id="key" type="password" value="${esc(S.getKey())}" autocomplete="off"></label>
        <button id="saveKey" class="sub">${esc(t("save"))}</button>
      </details>
      <p class="note">${esc(t("devKeyNote"))}</p>
    </section>
    <section class="card">
      <h2>${esc(t("records"))}</h2>
      <p>${sessions.length} ${esc(t("times"))} ・ ${(totalSec / 60).toFixed(1)} ${esc(t("minutes"))} ・ ${esc(t("estCost"))} ${totalYen.toFixed(1)}円
        ${totalSec ? `（${(totalYen / (totalSec / 60)).toFixed(2)}円/${esc(t("minutes"))}）` : ""}</p>
      <table class="rec"><tr><th>${esc(t("date"))}</th><th>${esc(t("scene"))}</th><th>${esc(t("seconds"))}</th><th>${esc(t("goalShort"))}</th><th>円</th></tr>
      ${sessions.map(s => `<tr><td>${esc(s.at.slice(5, 16).replace("T", " "))}</td><td>${esc(s.type === "exam" ? `📝 ${s.exam} ${s.score}/${s.total}` : s.type === "drill" ? "👂 " + s.drill : SCENES.find(x => x.id === s.scene)?.title_ja.slice(0, 10) || s.scene)}</td>
        <td>${s.seconds}</td><td>${s.type === "drill" ? (s.ok ? "○" : "△") : s.feedback ? (s.feedback.goal_achieved ? "○" : "△") : "−"}</td><td>${cost(s).toFixed(1)}</td></tr>`).join("")}
      </table>
      <button id="export" class="sub">${esc(t("export"))}</button>
      <button id="wipe" class="sub danger">${esc(t("deleteRecords"))}</button>
    </section>
    <section class="card"><h2>${bi("chooseLang")}</h2><div class="row">
      ${[["ja", "日本語"], ["en", "English"], ["vi", "Tiếng Việt"]].map(([v, n]) => `<button class="choice ${L() === v ? "on" : ""}" data-lang="${v}">${n}</button>`).join("")}
    </div></section>`);
  $app.querySelector(".back").onclick = renderHome;
  $app.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { setLang(b.dataset.lang); renderSettings(); });
  document.getElementById("saveKey").onclick = () => { S.setKey(document.getElementById("key").value); alert("OK"); };
  document.getElementById("auto").onclick = async () => {
    preloadGis();   // iPhone でログイン画面を開けるよう、押した直後に読み込みを始める
    const $s = document.getElementById("autoStatus"), btn = document.getElementById("auto");
    btn.disabled = true;
    try {
      const key = await autoSetup({ model: TEXT_MODEL, onStep: m => { $s.textContent = m; $s.classList.remove("err"); } });
      S.setKey(key);
      $s.textContent = "✅ " + t("keyReady");
      setTimeout(renderHome, 1200);
    } catch (e) {
      console.error(e);
      $s.textContent = e.message; $s.classList.add("err");
      btn.disabled = false;
    }
  };
  document.getElementById("export").onclick = () => {
    const blob = new Blob([JSON.stringify(S.getSessions(), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nihongo-kaiwa-records-${Date.now()}.json`; a.click();
  };
  document.getElementById("wipe").onclick = () => { if (confirm(t("deleteConfirm"))) { S.clearAll(); renderSetup(); } };
}

// ───── 起動 ─────
if (S.getProfile()?.consent?.version === CONSENT_VERSION) renderHome(); else renderSetup();
