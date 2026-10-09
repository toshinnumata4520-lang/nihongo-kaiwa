import { t, tja, getLang, setLang } from "./i18n.js?v=202610092323";
import { SCENES } from "./scenes.js?v=202610092323";
import { SITUATIONS } from "./situations.js?v=202610092323";
import { SAFETY_RULES, mask } from "./safety.js?v=202610092323";
import { startConversation, stopConversation, sendNote, liveSpeak, muteFor, LIVE_MODEL } from "./live.js?v=202610092323";
import { makeFeedback, judgeRetry, judgeDrill, makeScaffold, judgeTodo, tts, TEXT_MODEL } from "./coach.js?v=202610092323";
import { DRILLS, DRILL_INDUSTRIES } from "./drills.js?v=202610092323";
import { EXAMS } from "./exams.js?v=202610092323";
import { RUBY } from "./ruby.js?v=202610092323";
import * as S from "./store.js?v=202610092323";
import { autoSetup, preloadGis } from "./setup.js?v=202610092323";

const CONSENT_VERSION = "trial-2026-10-v2";   // v2: 音声入力（ブラウザの音声認識）の送り先を説明に追加
const MAX_SECONDS = 300;                       // 1場面は最長5分（原価を抑えるため）
const YEN = 150;                               // 1ドル＝150円で試算
// 料金（1ドル単位・100万トークンあたり）。原価の実測用の目安。正式な単価は料金表で再確認する
const PRICE = { liveAudioIn: 3, liveAudioOut: 12, liveTextIn: 0.75, liveTextOut: 4.5, textIn: 0.3, textOut: 2.5 };

const $app = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const L = () => getLang();
// ふりがな：「漢字(よみ)」の形を <ruby> にする。「｜」があれば、そこから後ろだけに付ける（例：｜3日(みっか)）
const rubyHtml = s => esc(s).replace(/(?:｜([0-9０-９一-龯々〆ヶ]+)|([一-龯々〆ヶ]+))\(([ぁ-んー]+)\)/g, (_, a, b, r) => `<ruby>${a || b}<rt>${r}</rt></ruby>`).replace(/｜/g, "");
// 日本語の文を表示する。ふりがながONで、ふりがな表（ruby.js）にあれば、ふりがな付きにする
const jr = s => S.getFurigana() && RUBY[s] ? rubyHtml(RUBY[s]) : esc(s);
// 画面の言葉：日本語の画面ならふりがな付き
const tx = k => L() === "ja" ? jr(t(k)) : esc(t(k));
// 選んだ言語の文と、日本語の文を並べる（日本語を読む練習にもなるように）
const bi = k => L() === "ja" ? jr(t(k)) : `${esc(t(k))}<span class="ja">${jr(tja(k))}</span>`;
const sceneTitle = sc => L() === "ja" ? sc.title_ja : sc.title?.[L()] || sc.title_ja;
const sceneGoal = sc => L() === "ja" ? sc.goal_ja : sc.goal?.[L()] || sc.goal_ja;

// 画面を切り替えるたびに、前の画面の音・マイク・AIとの接続をすべて止める
// （「画面を変えても音声が流れ続ける」への対応）。playToken は、作りかけの声が後から別の画面で鳴るのを防ぐ番号
let playToken = 0;
const playingSources = new Set();
let currentRec = null;
let activeTalkFinish = null;
let voiceAbort = new AbortController();   // 作りかけの声（liveSpeak）を、画面の切り替えで止める
try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}   // iPhoneの消音スイッチがオンでも鳴らす（iOS 17以降）
// 音を鳴らす AudioContext は1つだけにする（iPhoneは同時に作れる数に上限がある）
let audioCtx = null;
const getCtx = () => (audioCtx ||= new (window.AudioContext || window.webkitAudioContext)());
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
// 流れている音だけを止める（マイクの聞き取りは止めない）
function stopPlayback() {
  for (const s of playingSources) try { s.stop(); } catch {}
  playingSources.clear();
  // iPhoneは cancel のすぐあとの speak が鳴らないことがあるので、読み上げ中のときだけ止める
  try { if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel(); } catch {}
}
function stopAllAudio() {
  stopPlayback();
  voiceAbort.abort(); voiceAbort = new AbortController();
  try { currentRec?.abort(); } catch {}
  currentRec = null;
}
function playBuffer(buf, token) {
  if (token !== playToken) return;   // 声ができる前に画面が変わった・別の声を頼まれたら鳴らさない
  stopPlayback();
  const ctx = getCtx();
  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination);
  playingSources.add(src); src.onended = () => playingSources.delete(src);
  src.start();
  muteFor(buf.duration * 1000 + 400);   // 会話中なら、この声をマイクが拾わないようにする
}
// 作った声は使い回す。作っている途中の声も使い回す（連打しても接続を何本も開かない）
const voiceCache = new Map();
async function toBuffer(a) {
  const ctx = getCtx();
  if (a.isWav) return ctx.decodeAudioData(a.bytes.buffer.slice(0));
  const n = a.bytes.length >> 1, buf = ctx.createBuffer(1, n, a.rate);
  const ch = buf.getChannelData(0), dv = new DataView(a.bytes.buffer);
  for (let i = 0; i < n; i++) ch[i] = dv.getInt16(i * 2, true) / 0x8000;
  return buf;
}
function getVoice(ck, make) {
  if (!voiceCache.has(ck)) {
    const p = make(voiceAbort.signal).then(toBuffer);
    p.catch(() => voiceCache.delete(ck));
    voiceCache.set(ck, p);
  }
  return voiceCache.get(ck);
}
// AIの声が作れなかったら、1分間はスマホの読み上げを「ボタンを押したその場で」使う（一時的な電波の悪さで、ずっと使えなくならないように）
// （iPhoneは、押した直後でないと読み上げが鳴らないため、待ってから代わりに鳴らすことはできない）
let ttsFailAt = 0;
const ttsOk = () => Date.now() - ttsFailAt > 60000;
const isAbort = e => e?.name === "AbortError";

function show(html) {
  playToken++;
  stopAllAudio();
  if (activeTalkFinish) { const f = activeTalkFinish; activeTalkFinish = null; f(true); }   // 会話中に画面が変わったら会話を閉じる
  document.body.classList.remove("hastabs");
  $app.innerHTML = html; window.scrollTo(0, 0);
  wireSay($app);
}
const wireSay = root => root.querySelectorAll("[data-say]").forEach(b => b.onclick = () => say(b.dataset.say, b.dataset.reading || ""));
// アプリを閉じた・別のアプリに切り替えたときも止める
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") return;
  playToken++;
  stopAllAudio();
  if (activeTalkFinish) { const f = activeTalkFinish; activeTalkFinish = null; f(); }
});

// お手本の声。キーがあればAIの自然な声、なければスマホの読み上げ。reading は全文ひらがなの読み方
async function say(text, reading = "") {
  const kana = reading && !/[(（]/.test(reading) ? reading : "";
  // 短い言葉（用語カードなど）は、AIの声だと発音が崩れたり説明をしゃべったりするので、スマホの読み上げで読む
  if (text.replace(/[。、！？\s]/g, "").length <= 10) { sayLocal(kana || text); return; }
  if (S.getKey() && ttsOk()) {
    const my = ++playToken;
    stopPlayback();
    try {
      await getCtx().resume();
      const buf = await getVoice("say:" + text, signal => liveSpeak(S.getKey(), text, { style: "日本語の先生が、はっきり自然に", reading, signal }));
      playBuffer(buf, my);
      return;
    } catch (e) {
      if (isAbort(e)) return;
      console.warn("TTS fallback", e); ttsFailAt = Date.now();
      if (my === playToken && !isIOS) sayLocal(kana || text);   // Androidなどは、その場でスマホの読み上げに切り替える
      return;
    }
  }
  sayLocal(kana || text);
}
function sayLocal(text, rate = 0.85) {
  if (!window.speechSynthesis) return;
  stopPlayback();
  const u = new SpeechSynthesisUtterance(text); u.lang = "ja-JP"; u.rate = rate;
  const v = jaVoice(); if (v) u.voice = v;
  muteFor(text.length * 250 / rate + 800);
  speechSynthesis.speak(u);
}
// 日本語の声は、一覧があとから読み込まれる端末（Android）があるので、毎回さがす
const jaVoice = () => { try { return speechSynthesis.getVoices().find(v => /^ja[-_]JP/i.test(v.lang)) || null; } catch { return null; } };
const sayBtn = (text, reading = "") => `<button class="say" data-say="${esc(text)}" data-reading="${esc(reading)}" aria-label="${esc(t("listen"))}">🔊</button>`;

const fmtAt = at => { const d = new Date(at); return `${S.localDate(d).slice(5)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

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
      <p>${tx("consentBody")}</p>
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
  "旅館・ホテル": { icon: "🏨", furi: "りょかん", en: "Hotel / Ryokan", vi: "Khách sạn / Ryokan" },
  "飲食": { icon: "🍽️", furi: "いんしょく", en: "Restaurant", vi: "Nhà hàng" },
};
function industryLabel(i) {
  const x = INDUSTRY[i] || { icon: "", furi: "" };
  return `<span class="indicon">${x.icon}</span><ruby>${esc(i)}<rt>${esc(x.furi)}</rt></ruby>${L() !== "ja" && x[L()] ? `<small>${esc(x[L()])}</small>` : ""}`;
}

// AIの準備（キー）がまだのとき：開発者向けの設定画面に飛ばさず、やさしく説明して、すぐできる練習へ案内する
function renderNeedSetup() {
  show(`
    <button class="back link">← ${tx("home")}</button>
    <section class="card goal">
      <h2>🔒 ${bi("needSetupTitle")}</h2>
      <p>${bi("needSetupBody")}</p>
    </section>
    <button id="goDrill" class="primary">👂 ${bi("drillTitle")}</button>
    <button id="goExam" class="primary">📝 ${bi("examTitle")}</button>
    <details><summary class="note">${tx("forStaff")}</summary><button id="goSettings" class="sub">⚙ ${tx("settings")}</button></details>`);
  $app.querySelector(".back").onclick = renderHome;
  document.getElementById("goDrill").onclick = () => renderDrill(DRILLS.filter(d => d.industry === DRILL_INDUSTRIES[0]), 0);
  document.getElementById("goExam").onclick = () => startExam(EXAM_SETS[0]);
  document.getElementById("goSettings").onclick = renderSettings;
}

// ───── ホーム ─────
// ───── ホーム：下のタブで4つに分ける（1ページに全部ならべると長く、場面練習が下に隠れていたため） ─────
// きょう＝つぎにやること・復習 / 会話＝場面練習 / 聞く＝聞いてくりかえす / 試験＝試験たいさく
const TABS = [
  { id: "today", icon: "🏠", k: "tabToday" },
  { id: "talk", icon: "🗣", k: "tabTalk" },
  { id: "listen", icon: "👂", k: "tabListen" },
  { id: "exam", icon: "📝", k: "tabExam" },
];
let currentTab = (() => { try { return localStorage.getItem("nk.tab") || "today"; } catch { return "today"; } })();
const sceneArea = sc => sc.title_ja.split("：")[0];   // 「飲食：注文を受けて…」→「飲食」
const sceneShort = sc => sc.title_ja.split("：").slice(1).join("：") || sc.title_ja;
// 場面の名前は「業種：内容」。ふりがな表に全体があれば、業種と内容のふりがなもそこから作る
for (const sc of SCENES) {
  const r = RUBY[sc.title_ja]; if (!r || !r.includes("：")) continue;
  const [ar, ...rest] = r.split("："), [arJa, ...restJa] = sc.title_ja.split("：");
  RUBY[arJa] ||= ar; RUBY[restJa.join("：")] ||= rest.join("：");
}
const STATUS_LABEL = { new: "st_new", trying: "st_trying", done: "st_done", fluent: "st_fluent" };

// short=true：業種の見出しの下では「飲食：」などを省く
function sceneButton(sc, short = false) {
  const st = S.sceneStatus(sc.id);
  const ja = short ? sceneShort(sc) : sc.title_ja;
  return `<button class="scene" data-id="${sc.id}">
    <span class="badge ${st}">${tx(STATUS_LABEL[st])}</span>
    <span class="title">${L() === "ja" ? jr(ja) : esc(sceneTitle(sc))}</span>
    ${L() !== "ja" ? `<span class="ja">${jr(ja)}</span>` : ""}
    <span class="level">${esc(sc.level)}</span>
  </button>`;
}
// つぎのおすすめ：まだ「できた」になっていない場面のうち、練習中のもの → まだのもの の順
function nextScene() {
  const order = { trying: 0, new: 1, done: 2, fluent: 3 };
  return SCENES.slice().sort((x, y) => order[S.sceneStatus(x.id)] - order[S.sceneStatus(y.id)])[0];
}

function renderHome(tab) {
  if (typeof tab !== "string") tab = currentTab;   // 「← ホームへ」から呼ばれたときは、前にいたタブへ戻る
  currentTab = tab;
  try { localStorage.setItem("nk.tab", tab); } catch {}
  const due = S.dueCards().length;
  let body = "";
  if (tab === "today") {
    const sc = nextScene();
    body = `
    <section class="stats">
      <div><b>${S.practiceDays()}</b><small>${bi("daysPracticed")}</small></div>
      <button id="review" class="statbtn ${due ? "due" : ""}"><b>${due}</b><small>${bi("reviewToday")}</small></button>
    </section>
    <h2>${bi("nextUp")}</h2>
    ${sceneButton(sc)}
    <div class="quick">
      <button class="quickbtn" data-go="listen">👂 ${bi("drillTitle")}</button>
      <button class="quickbtn" data-go="exam">📝 ${bi("examTitle")}</button>
    </div>
    <p class="note">${bi("aiNote")}</p>`;
  } else if (tab === "talk") {
    const areas = [...new Set(SCENES.map(sceneArea))];
    body = `<h2>🗣 ${bi("scenes")}</h2>
    ${areas.map(ar => `<h3 class="area">${jr(ar)}</h3>${SCENES.filter(sc => sceneArea(sc) === ar).map(sc => sceneButton(sc, true)).join("")}`).join("")}`;
  } else if (tab === "listen") {
    body = `<section class="card drillentry">
      <h2>👂 ${bi("drillTitle")}</h2>
      <p class="note">${tx("drillNote")}</p>
      <div class="row">${DRILL_INDUSTRIES.map(i => `<button class="choice ind" data-ind="${esc(i)}">${industryLabel(i)}</button>`).join("")}</div>
    </section>`;
  } else {
    body = `<section class="card">
      <h2>📝 ${bi("examTitle")}</h2>
      <div class="row">${EXAM_SETS.map((s, i) => s.group ? "" : `<button class="choice" data-exam="${i}">${esc(s.name)}</button>`).join("")}</div>
      <p class="note">${tx("examGroup2")}</p>
      <div class="row">${EXAM_SETS.map((s, i) => s.group ? `<button class="choice" data-exam="${i}">${jr(s.name)}</button>` : "").join("")}</div>
      <p class="note">${tx("examNote")}</p>
    </section>`;
  }
  show(`
    <header class="top"><h1>${bi("appName")}</h1>
      <div class="row tight">
        <label class="toggle"><input type="checkbox" id="furi" ${S.getFurigana() ? "checked" : ""}> ${tx("furigana")}</label>
        <button id="settings" class="sub settingsbtn" aria-label="${esc(t("settingsShort"))}">⚙ ${tx("settingsShort")}</button>
      </div></header>
    ${body}
    <nav class="tabbar">${TABS.map(x => `<button class="tab ${x.id === tab ? "on" : ""}" data-tab="${x.id}"><span class="ticon">${x.icon}</span><span>${esc(t(x.k))}</span></button>`).join("")}</nav>`);
  document.body.classList.add("hastabs");
  $app.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => renderHome(b.dataset.tab));
  $app.querySelectorAll("[data-go]").forEach(b => b.onclick = () => renderHome(b.dataset.go));
  $app.querySelectorAll(".scene").forEach(b => b.onclick = () => renderPrep(SCENES.find(s => s.id === b.dataset.id)));
  $app.querySelectorAll("[data-ind]").forEach(b => b.onclick = () => renderDrill(DRILLS.filter(d => d.industry === b.dataset.ind), 0));
  $app.querySelectorAll("[data-exam]").forEach(b => b.onclick = () => startExam(EXAM_SETS[+b.dataset.exam]));
  document.getElementById("review")?.addEventListener("click", renderReview);
  document.getElementById("settings").onclick = renderSettings;
  document.getElementById("furi").onchange = e => { S.setFurigana(e.target.checked); renderHome(tab); };
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
  const both = o => L() === "ja" ? jr(o.ja) : `${esc(loc(o))}<span class="ja">${jr(o.ja)}</span>`;
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
const SCAF_VER = 2;   // 状況カード（situations.js）や場面を変えたら上げる。古い材料を使い続けないように
const scafValid = c => !!c?.steps?.length && c.steps.every(x => x.full && x.skeleton && Array.isArray(x.wrong) && Array.isArray(x.keywords));
function loadScaffold(sc) {
  const ck = `nk.scaf.${SCAF_VER}.${sc.id}.${L()}`;
  try { const c = JSON.parse(localStorage.getItem(ck)); if (scafValid(c)) return Promise.resolve(c); } catch {}
  if (!S.getKey() || !SITUATIONS[sc.id]) return Promise.resolve(null);
  return scafPending[ck] ||= makeScaffold(S.getKey(), sc, SITUATIONS[sc.id], L())
    .then(r => {
      if (!scafValid(r.result)) throw new Error("bad scaffold");
      try { localStorage.setItem(ck, JSON.stringify(r.result)); } catch {}
      return r.result;
    })
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
    return `<li>${body}<details><summary class="note">${tx("showAnswer")}</summary>
      <span class="jp">${sayBtn(st.full, st.furigana)}${esc(st.full)}</span>${S.getFurigana() ? `<span class="furi">${esc(st.furigana)}</span>` : ""}<span class="tr">${esc(st.meaning)}</span></details></li>`;
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
  $app.querySelectorAll(".support [data-say]").forEach(b => b.onclick = () => say(b.dataset.say, b.dataset.reading || ""));
}

function renderPrep(sc) {
  loadScaffold(sc);   // 会話を始める前に、手助けの材料を先に作っておく
  const lv = getLevel(sc), rec = recommendLevel(sc);
  show(`
    <button class="back link">← ${tx("home")}</button>
    <h1>${L() === "ja" ? jr(sc.title_ja) : esc(sceneTitle(sc))}</h1>
    <section class="card goal">
      <h2>${bi("todayGoal")}</h2>
      <p class="big">${L() === "ja" ? jr(sc.goal_ja) : esc(sceneGoal(sc))}</p>
      ${L() !== "ja" ? `<p class="ja">${jr(sc.goal_ja)}</p>` : ""}
    </section>
    ${situationHtml(sc)}
    <section class="card">
      <div class="row between"><h2>${bi("phrases")}</h2>
        <label class="toggle"><input type="checkbox" id="furi" ${S.getFurigana() ? "checked" : ""}> ${tx("furigana")}</label></div>
      <ul class="phrases">${sc.key_phrases.map(phraseHtml).join("")}</ul>
    </section>
    <section class="card">
      <h2>${bi("levelTitle")}</h2>
      <div class="levels">${LEVELS.map(x => `<button class="choice lv ${x.n === lv ? "on" : ""}" data-lv="${x.n}">${esc(t(x.k))}${x.n === rec ? `<small>★${tx("recommended")}</small>` : ""}</button>`).join("")}</div>
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
    5: "学習者は状況カードだけで話すいちばん上の段階。ふつうの速さで話す。途中で、状況と矛盾しない予想外のこと（例：「今、手が離せない」「その時間だと困る」）を1つだけ混ぜてよい。",
  }[level] || "";
  const s = SITUATIONS[sc.id];
  const langName = { ja: "やさしい日本語", en: "英語", vi: "ベトナム語" }[L()] || "英語";
  return `${SAFETY_RULES}

# 練習の内容
これは外国人の日本語学習者（目安 ${sc.level}）との、職場・生活の会話練習（ロールプレイ）です。
あなたの役: ${sc.ai_role}
学習者の練習用の名前: ${mask(nick)}（本名ではない）
今日の目標: ${sc.goal_ja}
${s ? `学習者に見せている状況: ${s.you.ja} ${s.now.ja}
学習者がやること（順番の目安）: ${s.todo.map((x, i) => `${i + 1}. ${x.ja}`).join(" / ")}
この状況の設定（人名・時間・数字）に合わせて会話する。学習者に見せていない設定を勝手に増やさない（例外は「今回の手助けの段階」で認めたものだけ）。` : ""}
この場面の注意: ${sc.safety_note}

# 場面から外れたとき（先生として短く指摘する）
- 学習者が、この場面・状況と関係ないこと、状況と合わないこと（例：遅刻の電話なのに雑談を始める、店員なのに自分が客のように話す、状況と違う時間や理由を言う）を言ったら、役をいったん止めて「（せんせい）今は${sc.title_ja.replace(/^.*?：/, "")}の場面です。〜を言いましょう。」のように、次にやることを1つだけ短く伝える。そのあと「では、もう一度。」と言って、すぐに役に戻る。
- 学習者が何を言えばいいか分からず黙ったり「わからない」と言ったら、まだできていない「やること」の次の1つを、やさしい日本語で短く教える。2回目も伝わらなければ${langName}で一言だけ説明する。

# 日本語の間違いを、その場で直す（先生として短く）
- はっきりした日本語の間違いは、聞き流さずに、その発言のすぐあとで直す。例：「あるです」「あるですます」「行くです」「食べるでした」（動詞に「です」を付ける）、動詞・形容詞の形の間違い（「痛いがあります」「止めるました」）、助詞の大きな間違い、上司やお客様へのていねいさの間違い（「わかった」「ちょっと待って」）。
- 直し方：役をいったん止めて「（せんせい）『〇〇』ですね。もう一度 言ってみましょう。」と、正しい言い方を1つだけ短く言う。学習者が言い直したら「いいですね。」と言って、すぐ役に戻る。
- 1回の発言で直すのは1つだけ。いちばん大事な間違いを選ぶ。言い直しがうまくいかなくても、2回目で役に戻る（責めない）。
- 先生として口をはさむのは、1回の発言につき1回だけ。場面から外れた指摘と日本語の直しが両方あてはまるときは、場面の指摘だけをする。
- 小さな間違い（意味は通じる助詞のゆれ、少しくだけた言い方）は、手助けの段階が2・3のときは直さず、役のまま会話を続ける。
- 文字起こしの誤認識らしいもの（意味は通じる言いよどみ・言い直し）は直さない。
- 正しい敬語は直さない。「〜でございます」「2階にございます」「〜におります」「伺います」「かしこまりました」「少々お待ちください」などは、接客で正しい言い方なので、まちがいとして扱わない。

# 読み方（発音をまちがえない）
- この場面のお手本の文と、その読み方。この読み方で発音する：
${sc.key_phrases.map(p => `  ${p.ja} → ${p.furigana}`).join("\n")}
- まちがえやすい読み：薬＝くすり（「やく」ではない）、〇番＝〇ばん、〇卓＝〇たく、37度5分＝さんじゅうななどごぶ、9時半＝くじはん、10分＝じゅっぷん、1人＝ひとり、2人＝ふたり、〇日＝ついたち・ふつか・みっか…（日付は正しく）、何時＝なんじ、上手＝じょうず、下手＝へた、今日＝きょう、明日＝あした。
- 読み方に自信がない漢字の言葉は、使わずに、やさしい言葉に言いかえる。

# 今回の手助けの段階
${levelRule}

# 話し方
- 日本語だけで話す（例外：伝わらないときの一言の説明だけは${langName}。安全ルールの「英語で一言」も${langName}に読みかえる）。学習者に合わせて、短い文で、少しゆっくり話す。1回に1つだけ質問する。
- 意味が分からないときは、役のまま自然に聞き返す。
- 目標が達成されたら、役として自然に会話を終える。
- 最初の一言は「${sc.opening_line}」。
- 丸かっこ（ ）の中の文は、学習者が画面のボタンを押した合図。声に出して読まず、返事もせず、黙ってその指示に従う。`;
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
      <div class="row between"><h1>${L() === "ja" ? jr(sc.title_ja) : esc(sceneTitle(sc))}</h1><span id="clock" class="clock">5:00</span></div>
      <div id="turn" class="turn wait"><span class="icon">⏳</span>${tx("connecting")}</div>
      <p id="status" class="status note">${tx("connecting")}</p>
      <div class="meter"><div id="level"></div></div>
      <div id="log" class="log"></div>
      <div id="support"></div>
      <details class="sitbox" open><summary>${tx("situation")}${level < 5 ? "・" + tx("todo") : ""}</summary>${situationHtml(sc, true, level >= 5)}</details>
      <p id="hintText" class="hinttext" hidden></p>
      <div class="row">
        <button id="hint" class="sub">💡 ${tx("hint")}</button>
        <button id="slow" class="sub">🐢 ${tx("slower")}</button>
      </div>
      <form id="typeForm" class="row"><input id="typeBox" placeholder="${esc(t("typeHere"))}"><button class="sub">${tx("send")}</button></form>
      <div id="endrow"><button id="end" class="primary">${bi("end")}</button></div>
    </div>`);
  const $log = document.getElementById("log"), $status = document.getElementById("status");
  // 話す人ごとに「いま書き足している発言」を持つ（学習者とAIの文字起こしが交互に届いても、発言が細切れにならないように）
  const open = { me: null, ai: null };
  const add = (who, text) => {
    if (!open[who]) { open[who] = { who, text: "" }; transcript.push(open[who]); }
    open[who].text += text;
    $log.innerHTML = transcript.filter(m => m.text.trim()).map(m =>
      `<p class="msg ${m.who}">${esc(mask(m.text))}</p>`).join("");
    $log.scrollTop = $log.scrollHeight;
  };
  const setStatus = (text, isErr) => { $status.textContent = text; $status.classList.toggle("err", !!isErr); };
  // 会話を続けられないとき：結果画面には進まず、理由と「もう一度」「ホーム」を出す
  const stuck = (msgKey, detail) => {
    finished = true; activeTalkFinish = null; clearInterval(timer);
    stopConversation();
    console.warn("talk stopped", msgKey, detail);
    // 学習者には英語の生エラーを見せない。キーの誤りだけは分かるように言いかえる
    setStatus(/API key/i.test(detail || "") ? t("keyInvalid") : t(msgKey), true);
    const $t = document.getElementById("turn"); if ($t) { $t.className = "turn wait"; $t.innerHTML = `<span class="icon">⚠️</span>${esc(t(msgKey))}`; }
    document.getElementById("endrow").innerHTML = `<div class="row"><button id="again" class="primary">🔁 ${tx("reconnect")}</button><button id="home" class="sub">${tx("home")}</button></div>`;
    document.getElementById("again").onclick = () => renderTalk(sc);
    document.getElementById("home").onclick = renderHome;
  };
  const $support = document.getElementById("support");
  loadScaffold(sc).then(scaf => {
    if (!$support.isConnected) return;   // 材料ができる前に、別の画面に移っていたら何もしない
    if (scaf) { $support.innerHTML = supportHtml(scaf, level); wireSupport(scaf); }
    else if (level < 5) $support.innerHTML = `<p class="note">${tx("scafFailed")}</p>`;
  });

  // 「やること」を言えたら ✅ を付ける（AIの番が終わるたびに確かめる。前の確認が終わるまでは重ねない）
  const todos = SITUATIONS[sc.id]?.todo || [];
  const todoDone = todos.map(() => false);
  let todoBusy = false;
  async function checkTodo() {
    if (!todos.length || todoBusy || todoDone.every(Boolean) || !transcript.some(m => m.who === "me" && m.text.trim())) return;
    todoBusy = true;
    try {
      const { result } = await judgeTodo(key, todos.map(x => x.ja), transcript.filter(m => m.text.trim()).map(m => ({ who: m.who, text: mask(m.text) })));
      (result.done || []).forEach((d, i) => { if (d && i < todoDone.length) todoDone[i] = true; });   // 一度✅になったら消さない
      document.querySelectorAll(".talk .todo li").forEach((li, i) => li.classList.toggle("done", !!todoDone[i]));
    } catch (e) { console.warn("todo check", e); }
    finally { todoBusy = false; }
  }

  activeTalkFinish = finish;
  startConversation({
    key, systemText: systemFor(sc, level),
    openingText: "（練習を始めます。あなたの最初の一言から話してください）",
    onText: (who, text, done) => {
      if (finished) return;
      if (text) add(who, text);
      if (done) { open.me = null; open.ai = null; checkTodo(); }   // AIの発言が終わったら、どちらの発言も区切り、「やること」を確かめる
    },
    onStatus: (s, isErr, detail) => {
      if (finished) return;
      if (s === "listening") { setStatus(t("connected")); if (!timer) startTimer(); return; }   // 5分は、つながって話せる状態になってから数える
      if (s === "mic-denied") { stuck("micDenied", detail); return; }
      if (s === "time-up") { setStatus(t("timeUp")); return; }
      if (s === "closed" && isErr) setStatus(t("connLost") + (detail ? ` (${detail})` : ""), true);
    },
    onUsage: u => usage.push(u),
    // 接続が切れた：まだ何も話していなければ結果画面に進まず、つなぎ直せるようにする
    onClose: err => {
      if (finished) return;
      if (err && !transcript.some(m => m.who === "me" && m.text.trim())) stuck("connLost", err);
      else finish();
    },
    // 今だれが話す番かを、大きく色分けして出す（「話していいのか分からない」への対応）
    onTurn: s => {
      if (finished) return;
      const $t = document.getElementById("turn"); if (!$t) return;
      $t.className = "turn " + s;
      const icon = { wait: "⏳", ai: "🔊", you: "🎙️", hearing: "👂" }[s];
      $t.innerHTML = `<span class="icon">${icon}</span>` + bi({ wait: "turnWait", ai: "turnAi", you: "turnYou", hearing: "turnHearing" }[s]);
      if (s === "you") try { navigator.vibrate?.(120); } catch {}   // Androidは短く震えて知らせる
    },
    onLevel: v => { const $l = document.getElementById("level"); if ($l) $l.style.width = Math.round(v * 100) + "%"; },
  }).catch(e => { if (!finished) stuck("startFailed", e?.name || String(e).slice(0, 60)); });

  // 時間は「終わる時刻」から数える（1秒ごとに数を減らすと、タイマーが間引かれたときに5分を超えてしまう）
  let endAt = 0;
  function startTimer() {
    endAt = Date.now() + MAX_SECONDS * 1000;
    timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      const $c = document.getElementById("clock");
      if ($c) $c.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      if (left <= 0) finish();
    }, 1000);
  }

  document.getElementById("hint").onclick = () => {
    const h = document.getElementById("hintText");
    h.hidden = false; h.innerHTML = jr(sc.hints[hintIdx % sc.hints.length]); hintIdx++;
  };
  document.getElementById("slow").onclick = () => sendNote("（学習者が「ゆっくり」を押しました。これからは、もっとゆっくり、短い文で話してください）");
  document.getElementById("typeForm").onsubmit = e => {
    e.preventDefault();
    const box = document.getElementById("typeBox");
    const v = mask(box.value.replace(/[（）()]/g, "").trim());   // かっこはボタンの合図と区別できなくなるので取る
    if (!v) return;
    if (!sendNote(v)) { setStatus(t("connecting")); return; }   // つながっていないときは、送ったことにしない
    open.me = null; add("me", v); open.me = null;
    box.value = "";
  };
  document.getElementById("end").onclick = () => finish();

  // leaving=true: 画面が変わったので会話を閉じるだけ（結果画面は出さない）
  async function finish(leaving = false) {
    if (finished) return; finished = true;
    activeTalkFinish = null;
    clearInterval(timer);
    const seconds = stopConversation();
    if (leaving) return;
    const clean = transcript.filter(m => m.text.trim()).map(m => ({ who: m.who, text: mask(m.text) }));
    renderFeedback(sc, clean, seconds, usage);
  }
}

// ───── 直し ─────
async function renderFeedback(sc, transcript, seconds, liveUsage, isRetry = false) {
  show(`<p class="status">${tx("checking")}</p>`);
  let fb = null, textUsage = {}, failed = false;
  const spoke = transcript.some(m => m.who === "me");
  try {
    if (spoke) {
      const r = await makeFeedback(S.getKey(), sc, transcript, L());
      fb = r.result; textUsage = r.usage;
    }
  } catch (e) { console.error(e); failed = true; }
  if (fb && !fb.fix?.better) { fb = null; failed = true; }   // 返事が欠けているときは失敗として扱う
  if (!isRetry || fb) S.addSession({ scene: sc.id, level: getLevel(sc), at: new Date().toISOString(), seconds: Math.round(seconds), transcript, feedback: fb,
    usage: { live: liveUsage, text: textUsage }, models: { live: LIVE_MODEL, text: TEXT_MODEL } });

  if (!fb) {
    show(`<p>${esc(t(failed ? "error" : "noSpeech"))}</p>
      ${failed ? `<button class="primary" id="again">🔁 ${tx("checkAgain")}</button>` : `<button class="primary" id="again">🔁 ${tx("tryAgain")}</button>`}
      <button class="link" id="home">${tx("home")}</button>`);
    document.getElementById("home").onclick = renderHome;
    document.getElementById("again").onclick = () => failed ? renderFeedback(sc, transcript, seconds, liveUsage, true) : renderTalk(sc);
    return;
  }
  const f = fb.fix;
  // 直しは言い直しが成功しなくても復習に入れる（苦手な人ほど復習が必要なため）
  if (f.better) S.addCard({ scene: sc.id, better: f.better, better_furigana: f.better_furigana, meaning: f.better_meaning || "" });
  const why = L() === "ja" ? f.why_ja : f.why;
  show(`
    <h1>${bi("result")}</h1>
    <section class="card result ${fb.goal_achieved ? "ok" : ""}">
      <p class="big">${fb.goal_achieved ? "🎉 " + tx("goalDone") : "🙂 " + tx("goalAlmost")}</p>
      <p>${esc(fb.praise)}</p>
    </section>
    <section class="card">
      <h2>${bi("oneFix")}</h2>
      ${f.said ? `<p class="said">${tx("youSaid")}：${esc(f.said)}</p>
      <p class="think">🤔 ${bi("thinkFirst")}</p>
      <button id="showFix" class="sub">👀 ${tx("showAnswer")}</button>` : ""}
      <div id="fixBody" ${f.said ? "hidden" : ""}>
        <p class="better">${sayBtn(f.better, f.better_furigana)}${tx("better")}：<b>${esc(f.better)}</b></p>
        ${S.getFurigana() ? `<p class="furi">${esc(f.better_furigana)}</p>` : ""}
        <p class="why">${esc(why)}</p>
        ${L() !== "ja" ? `<p class="ja">${esc(f.why_ja)}</p>` : ""}
      </div>
    </section>
    ${(fb.model_lines || []).length ? `<details class="card">
      <summary><b>${bi("correctJa")}</b></summary>
      <ol class="model">${fb.model_lines.map(m => `<li>
        ${m.said ? `<span class="said">${tx("youSaid")}：${esc(m.said)}</span>` : `<span class="said">${tx("missing")}</span>`}
        <span class="jp">${sayBtn(m.correct, m.furigana)}${esc(m.correct)}</span>
        ${S.getFurigana() ? `<span class="furi">${esc(m.furigana)}</span>` : ""}
      </li>`).join("")}</ol>
    </details>` : ""}
    <button id="retry" class="primary big">🎙 ${bi("retry")}</button>
    <button id="home" class="link">${tx("home")}</button>`);
  document.getElementById("home").onclick = renderHome;
  document.getElementById("retry").onclick = () => renderRetry(sc, f);
  // まず自分で考えてから、こたえを見る（すぐ答えを見せると、覚えにくいため）
  const $sf = document.getElementById("showFix");
  if ($sf) $sf.onclick = () => { $sf.remove(); document.getElementById("fixBody").hidden = false; document.querySelector(".think")?.remove(); };
}

// ───── 言い直し（ブラウザの音声認識。使えない端末では文字で入力） ─────
// 「話す」ボタン：押すと赤く点滅して「聞いています」に変わり、聞き取れた文字をその場で見せる。
// 話し終わったら「おわり」（黙っていても自動で終わる）。聞き取れているかが目で分かるようにする
function listenOnce($btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return Promise.resolve(null);
  stopPlayback();   // 指示の声を流したまま聞き取ると、その声を学習者の発言として拾ってしまう
  try { currentRec?.abort(); } catch {}   // 前の聞き取りが残っていたら止める（同時に1つしか動かせない）
  const label = $btn?.innerHTML;
  return new Promise(resolve => {
    const r = new SR(); r.lang = "ja-JP"; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
    currentRec = r;   // 画面が変わったら止められるように
    let got = "", err = null, finished = false;
    const box = document.createElement("div");
    box.className = "livecap";
    box.innerHTML = `<span class="placeholder">${tx("speakNow")}</span>`;
    $btn?.after(box);
    if ($btn) {
      $btn.classList.add("recording");
      $btn.innerHTML = `🔴 ${bi("recording")}`;
      $btn.onclick = () => r.stop();   // 「おわり」
    }
    const guard = setTimeout(() => { try { r.stop(); } catch {} setTimeout(end, 1500); }, 15000);   // 終わりの合図が来ない端末の保険
    const end = () => {
      if (finished) return; finished = true;
      clearTimeout(guard);
      if (currentRec === r) currentRec = null;
      if ($btn) { $btn.classList.remove("recording"); $btn.innerHTML = label; }
      box.remove();
      resolve({ text: got, err });
    };
    r.onresult = e => {
      let txt = "";
      for (const res of e.results) txt += res[0].transcript;
      got = txt;
      box.textContent = txt || "…";
    };
    r.onerror = e => { err = e.error; end(); };
    r.onend = end;
    try { r.start(); } catch { end(); }
  });
}
// listenOnce は「おわり」でも使うので、ボタンの元の動きは呼び出し側で付け直す
function wireMic(onSaid, $res) {
  const $btn = document.getElementById("mic");
  if (!$btn) return;
  $btn.onclick = async () => {
    const r = await listenOnce($btn);
    if (!$btn.isConnected) return;   // 聞き取りの間に画面が変わっていたら何もしない
    wireMic(onSaid, $res);
    const focusType = () => document.getElementById("typeBox")?.focus();
    if (r === null) { $res.innerHTML = `<p class="status">${tx("noSR")}</p>`; focusType(); return; }
    if (r.err === "not-allowed" || r.err === "service-not-allowed" || r.err === "audio-capture") {
      $res.innerHTML = `<p class="status err">${tx("micDenied")}</p>`; focusType(); return;
    }
    if (r.err === "network" && !r.text) { $res.innerHTML = `<p class="status err">${tx("srNetwork")}</p>`; focusType(); return; }
    onSaid(r.text);
  };
}

function renderRetry(sc, fix, fromReview = null) {
  show(`
    <button class="back link">← ${tx("home")}</button>
    <h1>${bi("retry")}</h1>
    <p>${bi(fromReview ? "reviewPrompt" : "retryPrompt")}</p>
    <section class="card" id="target"${fromReview ? " hidden" : ""}>
      <p class="big">${sayBtn(fix.better, fix.better_furigana)}<b>${esc(fix.better)}</b></p>
      ${S.getFurigana() ? `<p class="furi">${esc(fix.better_furigana)}</p>` : ""}
      ${fix.better_meaning ? `<p class="tr">${esc(fix.better_meaning)}</p>` : ""}
    </section>
    <button id="mic" class="primary big">🎙 ${tx("speak")}</button>
    <form id="typeForm" class="row"><input id="typeBox" placeholder="${esc(t("typeHere"))}"><button class="sub">${tx("send")}</button></form>
    <p id="res" class="status"></p>`);
  $app.querySelector(".back").onclick = renderHome;
  const $res = document.getElementById("res");
  let tries = 0, busy = false, closed = false;
  const $target = document.getElementById("target");
  if (fromReview) $target.insertAdjacentHTML("afterend", `<section class="card"><p class="tr big">${esc(fix.better_meaning || "")}</p></section>`);
  const judge = async said => {
    if (busy || closed) return;
    if (!said) { $res.textContent = t("notHeard"); return; }
    said = mask(said);
    $target.hidden = false;   // 答えたら、正しい文を見せる
    if (!S.getKey()) {   // AIの判定が使えないときは、正しい文と比べて自分で〇つけ
      closed = true;
      $res.innerHTML = `${tx("youSaid")}：${esc(said)}<br>${tx("selfCheck")}<div class="row"><button id="selfok" class="sub">✅ ${tx("gotIt")}</button><button id="selfng" class="sub">🔁 ${tx("notYet")}</button></div>`;
      const done = ok => { if (fromReview) { S.gradeCard(fromReview, ok); renderReview(); } else renderHome(); };
      document.getElementById("selfok").onclick = () => done(true);
      document.getElementById("selfng").onclick = () => done(false);
      return;
    }
    busy = true;
    $res.textContent = t("checking");
    try {
      const { result } = await judgeRetry(S.getKey(), fix.better, said);
      if (!$res.isConnected) return;
      $res.innerHTML = `${esc(said)}<br><b>${result.ok ? "✅ " + tx("great") : "🔁 " + tx("again")}</b> ${esc(result.comment)}`;
      tries++;
      if (result.ok || tries >= 2) {   // ここで終わり：もう一度押せないようにする
        closed = true;
        document.getElementById("mic").disabled = true;
        document.querySelector("#typeForm button").disabled = true;
      }
      if (fromReview && (result.ok || tries >= 2)) { S.gradeCard(fromReview, result.ok); setTimeout(() => { if ($res.isConnected) renderReview(); }, 1500); return; }
      if (result.ok || tries >= 2) {   // 2回うまくいかなければ、くり返させずに先へ進める
        $res.insertAdjacentHTML("beforeend", `<br><button class="primary" id="done">${tx("home")}</button>`);
        document.getElementById("done").onclick = renderHome;
      }
    } catch (e) { console.error(e); $res.textContent = t("error"); }
    finally { busy = false; }
  };
  wireMic(judge, $res);
  document.getElementById("typeForm").onsubmit = e => { e.preventDefault(); judge(document.getElementById("typeBox").value.trim()); };
}

// ───── 聞いて くりかえす（復唱・聞き返し） ─────
// 指示の文字は最初は隠す（聞き取りの練習）。分からないときは聞き返すのが正解の問題もある
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
async function playVoice(d, slow) {
  const local = () => sayLocal(d.say_kana || d.say, slow ? 0.75 : d.style === "早口" || d.style === "略語" ? 1.3 : 1.1);
  if (!S.getKey() || !ttsOk()) { local(); return; }
  const my = ++playToken;
  stopPlayback();   // 連打しても重ならないように
  const $st = document.getElementById("voiceStatus");
  try {
    if ($st) $st.textContent = t("voiceLoading");
    await getCtx().resume();
    const style = slow ? "外国人にもわかるように、とてもゆっくり、はっきり言う" : STYLE_PROMPT[d.style];
    // 漢字の文に読み方を添えて、会話と同じAIに読ませる
    const buf = await getVoice("drill:" + d.id + (slow ? ":slow" : ""),
      signal => liveSpeak(S.getKey(), d.say, { style, reading: d.say_kana, voice: d.voice, signal }));
    if ($st?.isConnected && my === playToken) $st.textContent = "";
    playBuffer(buf, my);
  } catch (e) {
    if (isAbort(e)) return;
    console.warn("TTS fallback", e);
    ttsFailAt = Date.now();
    if ($st?.isConnected) $st.textContent = t("voiceRetry");
  }
}

const kanaLine = k => S.getFurigana() && k ? `<p class="furi">${esc(k)}</p>` : "";

function renderDrill(list, i) {
  // 最後の問題のあとは、だまってホームに戻らず、おわりの画面を出す
  if (i >= list.length) {
    show(`<h1>👂 ${bi("drillTitle")}</h1><section class="card result ok"><p class="big">🎉 ${tx("drillDone")}</p></section>
      <button id="again" class="primary">🔁 ${tx("examAgain")}</button><button id="home" class="link">${tx("home")}</button>`);
    document.getElementById("again").onclick = () => renderDrill(list, 0);
    document.getElementById("home").onclick = renderHome;
    return;
  }
  const d = list[i];
  const log = { replays: 0, slow: 0, revealed: false };
  show(`
    <button class="back link">← ${tx("home")}</button>
    <h1>👂 ${bi("drillTitle")}（${i + 1}/${list.length}）</h1>
    <section class="card situation">
      <p class="big">🗣 ${jr(d.speaker)}<span class="tag">${esc(d.style)}</span></p>
      <p>${bi("drillTask")}</p>
      <div class="row">
        <button id="play" class="primary">▶ ${tx("listen")}</button>
        <button id="slow" class="sub">🐢 ${tx("listenSlow")}</button>
      </div>
      <p id="voiceStatus" class="note"></p>
      <details id="reveal"><summary class="note">${tx("showText")}</summary><p class="big">${esc(d.say)}</p>${S.getFurigana() && d.say_kana ? `<p class="furi">${esc(d.say_kana)}</p>` : ""}</details>
      <p class="note">💡 ${tx("askTip")}</p>
    </section>
    <button id="mic" class="primary big">🎙 ${tx("speak")}</button>
    <form id="typeForm" class="row"><input id="typeBox" placeholder="${esc(t("typeHere"))}"><button class="sub">${tx("send")}</button></form>
    <div id="res"></div>`);
  $app.querySelector(".back").onclick = renderHome;
  document.getElementById("play").onclick = () => { log.replays++; playVoice(d, false); };
  document.getElementById("slow").onclick = () => { log.slow++; playVoice(d, true); };
  document.getElementById("reveal").ontoggle = e => { if (e.target.open) log.revealed = true; };
  log.replays++; playVoice(d, false);   // 最初に1回、自動で流す
  const $res = document.getElementById("res");
  let busy = false;
  const selfCheck = (said, failed) => {
      $res.innerHTML = (failed ? `<p class="status err">${tx("judgeFailed")}</p>` : "") + `<section class="card"><p class="said">${tx("youSaid")}：${esc(said)}</p>
        <p class="note">${tx("selfCheck")}</p>
        <p class="better">${sayBtn(d.model, d.model_kana)}${tx("modelAnswer")}：<b>${esc(d.model)}</b></p>${kanaLine(d.model_kana)}
        <p class="note">${tx("instruction")}：${esc(d.say)}</p>${kanaLine(d.say_kana)}</section>
        <div class="row"><button id="again" class="sub">🔁 ${tx("tryAgain")}</button><button id="next" class="primary">${tx("next")} →</button></div>`;
      $res.querySelectorAll("[data-say]").forEach(b => b.onclick = () => say(b.dataset.say, b.dataset.reading || ""));
      document.getElementById("again").onclick = () => renderDrill(list, i);
      document.getElementById("next").onclick = () => renderDrill(list, i + 1);
      $res.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const judge = async said => {
    if (busy) return;
    if (!said) { $res.innerHTML = `<p class="status">${tx("notHeard")}</p>`; return; }
    said = mask(said);
    if (!S.getKey()) { selfCheck(said); return; }   // AIの判定が使えないときは、お手本を見て自分で答え合わせして先へ進める
    $res.innerHTML = `<p class="status">${tx("checking")}</p>`;
    busy = true;
    try {
      const { result: r, usage } = await judgeDrill(S.getKey(), d, said, L());
      if (!$res.isConnected) return;
      r.checks = Array.isArray(r.checks) ? r.checks : [];
      // AIの ok と、項目ごとの判定が食い違わないようにそろえる
      if (d.kind !== "ask" && r.checks.length) r.ok = r.checks.every(c => c.ok);
      else if (d.kind === "ask" && r.checks.length) r.ok = r.ok && r.checks.some(c => c.ok);
      S.addSession({ type: "drill", drill: d.id, at: new Date().toISOString(), seconds: 0, said, ok: r.ok, checks: r.checks, ...log, usage: { text: usage } });
      $res.innerHTML = `
        <section class="card result ${r.ok ? "ok" : ""}">
          <p class="said">${tx("youSaid")}：${esc(said)}</p>
          <p class="big">${r.ok ? "✅ " + tx("great") : "🔁 " + tx("again")}</p>
          <ul class="checks">${r.checks.map(c => `<li>${c.ok ? "✅" : "⬜"} ${esc(c.item)}</li>`).join("")}</ul>
          <p>${esc(L() === "ja" ? r.comment_ja : r.comment)}</p>
          ${L() !== "ja" ? `<p class="ja">${esc(r.comment_ja)}</p>` : ""}
          <p class="better">${sayBtn(d.model, d.model_kana)}${tx("modelAnswer")}：<b>${esc(d.model)}</b></p>${kanaLine(d.model_kana)}
          <p class="note">${tx("instruction")}：${esc(d.say)}</p>${kanaLine(d.say_kana)}
        </section>
        <div class="row"><button id="again" class="sub">🔁 ${tx("tryAgain")}</button><button id="next" class="primary">${tx("next")} →</button></div>`;
      $res.querySelectorAll("[data-say]").forEach(b => b.onclick = () => say(b.dataset.say, b.dataset.reading || ""));
      document.getElementById("again").onclick = () => renderDrill(list, i);
      document.getElementById("next").onclick = () => renderDrill(list, i + 1);
    } catch (e) { console.error(e); if ($res.isConnected) selfCheck(said, true); }
    finally { busy = false; }
  };
  wireMic(judge, $res);
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
  if (q.term) return `${tx("cardQ")}<br><span class="term">${S.getFurigana() && q.reading && q.reading !== q.term ? `<ruby>${esc(q.term)}<rt>${esc(q.reading)}</rt></ruby>` : esc(q.term)}</span>`;
  // ふりがなが「全文ひらがな」の問題（一問一答）は、漢字の文の下に、ひらがなの行をそえる
  if (S.getFurigana() && q.question_furigana && !/[一-龯々]/.test(q.question_furigana) && q.question_furigana !== q.question_ja)
    return esc(q.question_ja).replace(/【(.+?)】/g, "<u>$1</u>").replace(/\n/g, "<br>") +
      `<span class="furi">${esc(q.question_furigana.split("\n").slice(1).join(" "))}</span>`;
  const raw = S.getFurigana() ? q.question_furigana : q.question_ja;
  let h = esc(raw).replace(/【(.+?)】/g, "<u>$1</u>");
  // 「｜」があれば、そこから後ろの漢字だけにふりがなを付ける（例：作業｜手順(てじゅん)）。ふりがなOFFでは「｜」を消す
  if (S.getFurigana()) h = h.replace(/(?:｜([0-9０-９一-龯々〆ヶ]+)|([一-龯々〆ヶ]+))\(([ぁ-んー]+)\)/g, (_, a, b, r) => `<ruby>${a || b}<rt>${r}</rt></ruby>`);
  h = h.replace(/｜/g, "");
  return h.replace(/\n/g, "<br>");
}

// 聴解の台本を、話す人ごとに声の高さを変えて読み上げる
function playScript(script) {
  if (!window.speechSynthesis) return;
  stopPlayback();
  const v = jaVoice();
  const lines = script.split("\n").map(line => {
    const m = line.match(/^([^：]{1,6})：(.*)$/);
    return { who: m?.[1] || "", text: m ? m[2] : line };
  });
  const others = [...new Set(lines.map(l => l.who).filter(w => w && w !== "男" && w !== "女"))];
  const pitchOf = w => w === "男" ? 0.7 : w === "女" ? 1.3 : w ? [0.85, 1.2, 1.0, 0.75][others.indexOf(w) % 4] : 1;
  for (const l of lines) {
    const u = new SpeechSynthesisUtterance(l.text);
    u.lang = "ja-JP"; u.rate = 0.95; if (v) u.voice = v;
    u.pitch = pitchOf(l.who);
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
  q.plays ||= 0;
  // 漢字の読み・書き方の問題は、選択肢にふりがなを付けると答えが分かってしまうので付けない
  const choiceRuby = !/漢字|表記|読み|用法|語彙/.test(q.section || "");   // 聞いた回数は問題に持たせる（ふりがなを切り替えて描き直しても、2回までのまま）
  const answered = () => results.some(r => r.id === q.id);
  show(`
    <button class="back link">← ${tx("home")}</button>
    <div class="row between"><h1>📝 ${esc(set.name)}（${i + 1}/${qs.length}）</h1>
      <label class="toggle"><input type="checkbox" id="furi" ${S.getFurigana() ? "checked" : ""}> ${tx("furigana")}</label></div>
    <p class="note">${jr(q.section)}</p>
    ${q.script ? `<button id="play" class="primary">▶ ${tx("listen")}（${tx("upTo2")}）</button>` : ""}
    <section class="card"><p class="big exq">${examText(q)}</p>${q.say ? sayBtn(q.say) : ""}</section>
    ${q.choicesShown
      ? `<div class="answers ${q.choicesShown.length === 2 ? "ox" : ""}">${q.choicesShown.map((c, k) => `<button class="ans" data-k="${k}">${q.choicesShown.length > 2 ? k + 1 + ". " : ""}${choiceRuby ? jr(c) : esc(c)}</button>`).join("")}</div>`
      : `<button id="reveal" class="primary">${tx("showAnswer")}</button>`}
    <div id="res"></div>`);
  $app.querySelectorAll("[data-say]").forEach(b => b.onclick = () => say(b.dataset.say, b.dataset.reading || ""));
  // こたえを見て自分で〇つけする問題
  const $rev = document.getElementById("reveal");
  if ($rev) $rev.onclick = () => {
    $rev.remove();
    const ex = L() === "ja" ? "" : q[`explain_${L()}`] || q.explain_en;
    const $r = document.getElementById("res");
    $r.innerHTML = `<section class="card"><p class="big"><b>${jr(q.answer_text)}</b></p>
        ${ex ? `<p>${esc(ex)}</p>` : ""}<p class="note">${jr(q.explain_ja)}</p></section>
      <div class="row"><button id="selfok" class="sub">✅ ${tx("gotIt")}</button><button id="selfng" class="sub">🔁 ${tx("notYet")}</button></div>`;
    $r.scrollIntoView({ behavior: "smooth", block: "start" });
    const go = ok => { if (!answered()) results.push({ id: q.id, ok }); renderExamQ(set, qs, i + 1, results); };
    document.getElementById("selfok").onclick = () => go(true);
    document.getElementById("selfng").onclick = () => go(false);
  };
  $app.querySelector(".back").onclick = renderHome;
  document.getElementById("furi").onchange = e => { S.setFurigana(e.target.checked); renderExamQ(set, qs, i, results); };
  const $play = document.getElementById("play");
  if ($play) { if (q.plays >= 2) $play.disabled = true; $play.onclick = () => { if (q.plays >= 2) return; q.plays++; playScript(q.script); if (q.plays >= 2) $play.disabled = true; }; }
  $app.querySelectorAll(".ans").forEach(b => b.onclick = () => {
    const k = +b.dataset.k, ok = k === q.answerShown;
    $app.querySelectorAll(".ans").forEach(x => { x.disabled = true; if (+x.dataset.k === q.answerShown) x.classList.add("right"); });
    if (!ok) b.classList.add("wrong");
    if (!answered()) results.push({ id: q.id, ok });   // ふりがなを切り替えて描き直しても、2回は数えない
    const ex = L() === "ja" ? q.explain_ja : q[`explain_${L()}`] || q.explain_en;
    document.getElementById("res").innerHTML = `
      <section class="card result ${ok ? "ok" : ""}">
        <p class="big">${ok ? "✅ " + tx("great") : "🔁 " + tx("examWrong")}</p>
        <p>${L() === "ja" ? jr(q.explain_ja) : esc(ex)}</p>${L() !== "ja" ? `<p class="ja">${jr(q.explain_ja)}</p>` : ""}
        ${q.script ? `<details><summary class="note">${tx("showText")}</summary><p>${esc(q.script).replace(/\n/g, "<br>")}</p></details>` : ""}
      </section>
      <button id="next" class="primary">${tx("next")} →</button>`;
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
    <button id="again" class="primary">🔁 ${tx("examAgain")}</button>
    <button id="home" class="link">${tx("home")}</button>`);
  document.getElementById("again").onclick = () => startExam(set);
  document.getElementById("home").onclick = renderHome;
}

// ───── 復習 ─────
function renderReview() {
  const cards = S.dueCards();
  if (!cards.length) {
    show(`<h1>${bi("reviewToday")}</h1><p>${bi("noReview")}</p><button class="primary" id="home">${tx("home")}</button>`);
    document.getElementById("home").onclick = renderHome;
    return;
  }
  const c = cards[0];
  show(`
    <button class="back link">← ${tx("home")}</button>
    <h1>${bi("reviewToday")}（${cards.length}）</h1>
    <section class="card"><p>${bi("howToSay")}</p><p class="big">${esc(c.meaning || "…")}</p></section>
    <button id="say" class="primary big">🎙 ${tx("speak")}</button>
    <button id="reveal" class="sub">${tx("showAnswer")}</button>
    <section id="ans" class="card" hidden><p class="big">${sayBtn(c.better_furigana || c.better)}<b>${esc(c.better)}</b></p>
      ${S.getFurigana() ? `<p class="furi">${esc(c.better_furigana)}</p>` : ""}
      <div class="row"><button id="ok" class="sub">✅ ${tx("gotIt")}</button><button id="ng" class="sub">🔁 ${tx("notYet")}</button></div></section>`);
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
    <button class="back link">← ${tx("home")}</button>
    <h1>${tx("settings")}</h1>
    <section class="card ${S.getKey() ? "" : "goal"}">
      <h2>${tx("easySetup")}</h2>
      <p class="note">${esc(t(S.getKey() ? "keyReady" : "easySetupNote"))}</p>
      <button id="auto" class="primary">🔑 ${tx("easySetupBtn")}</button>
      <p id="autoStatus" class="status"></p>
      <details><summary class="note">${tx("manualKey")}</summary>
        <label>${tx("devKey")}<input id="key" type="password" value="${esc(S.getKey())}" autocomplete="off"></label>
        <button id="saveKey" class="sub">${tx("save")}</button>
      </details>
      <p class="note">${tx("devKeyNote")}</p>
    </section>
    <section class="card">
      <h2>${tx("records")}</h2>
      <p>${sessions.length} ${tx("times")} ・ ${(totalSec / 60).toFixed(1)} ${tx("minutes")} ・ ${tx("estCost")} ${totalYen.toFixed(1)}円
        ${totalSec ? `（${(totalYen / (totalSec / 60)).toFixed(2)}円/${tx("minutes")}）` : ""}</p>
      <table class="rec"><tr><th>${tx("date")}</th><th>${tx("scene")}</th><th>${tx("seconds")}</th><th>${tx("goalShort")}</th><th>円</th></tr>
      ${sessions.map(s => `<tr><td>${esc(fmtAt(s.at))}</td><td>${esc(s.type === "exam" ? `📝 ${s.exam} ${s.score}/${s.total}` : s.type === "drill" ? "👂 " + s.drill : SCENES.find(x => x.id === s.scene)?.title_ja.slice(0, 10) || s.scene)}</td>
        <td>${s.seconds}</td><td>${s.type === "drill" ? (s.ok ? "○" : "△") : s.feedback ? (s.feedback.goal_achieved ? "○" : "△") : "−"}</td><td>${cost(s).toFixed(1)}</td></tr>`).join("")}
      </table>
      <button id="export" class="sub">${tx("export")}</button>
      <button id="wipe" class="sub danger">${tx("deleteRecords")}</button>
    </section>
    <section class="card"><h2>${bi("chooseLang")}</h2><div class="row">
      ${[["ja", "日本語"], ["en", "English"], ["vi", "Tiếng Việt"]].map(([v, n]) => `<button class="choice ${L() === v ? "on" : ""}" data-lang="${v}">${n}</button>`).join("")}
    </div></section>`);
  $app.querySelector(".back").onclick = renderHome;
  $app.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { setLang(b.dataset.lang); renderSettings(); });
  document.getElementById("saveKey").onclick = () => {
    const v = document.getElementById("key").value.trim();
    if (!v && S.getKey() && !confirm(t("deleteKeyConfirm"))) return;
    S.setKey(v); ttsFailAt = 0; voiceCache.clear(); alert("OK");
  };
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
