import { t, tja, getLang, setLang } from "./i18n.js";
import { SCENES } from "./scenes.js";
import { SITUATIONS } from "./situations.js";
import { SAFETY_RULES, mask } from "./safety.js";
import { startConversation, stopConversation, sendNote, LIVE_MODEL } from "./live.js";
import { makeFeedback, judgeRetry, judgeDrill, TEXT_MODEL } from "./coach.js";
import { DRILLS, DRILL_INDUSTRIES } from "./drills.js";
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

// お手本の声（ブラウザの読み上げ。端末の中で読み上げるだけで、外には送らない）
function say(text) {
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
    if (S.getKey()) renderHome(); else renderSettings();   // キーがまだなら、先にかんたん設定へ
  };
}

// ───── ホーム ─────
function renderHome() {
  const due = S.dueCards().length;
  const label = { new: "st_new", trying: "st_trying", done: "st_done", fluent: "st_fluent" };
  show(`
    <header class="top"><h1>${bi("appName")}</h1><button id="settings" class="link">⚙</button></header>
    <section class="stats">
      <div><b>${S.practiceDays()}</b><small>${bi("daysPracticed")}</small></div>
      <button id="review" class="statbtn ${due ? "due" : ""}"><b>${due}</b><small>${bi("reviewToday")}</small></button>
    </section>
    <section class="card drillentry">
      <h2>👂 ${bi("drillTitle")}</h2>
      <p class="note">${esc(t("drillNote"))}</p>
      <div class="row">${DRILL_INDUSTRIES.map(i => `<button class="choice" data-ind="${esc(i)}">${esc(i)}</button>`).join("")}</div>
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
  document.getElementById("review").onclick = renderReview;
  document.getElementById("settings").onclick = renderSettings;
}

// ───── 準備 ─────
function phraseHtml(p) {
  const furi = S.getFurigana();
  const tr = L() === "ja" ? p.en : p[L()] || p.en;
  return `<li class="phrase">${sayBtn(p.ja)}<span class="jp">${esc(p.ja)}</span>
    ${furi ? `<span class="furi">${esc(p.furigana)}</span>` : ""}
    <span class="tr">${esc(tr)}</span></li>`;
}

// 状況カード：自分の立場・いま起きていること・伝えること。準備画面と会話中の両方に出す
const loc = o => L() === "ja" ? o.ja : o[L()] || o.en;
function situationHtml(sc, compact = false) {
  const s = SITUATIONS[sc.id];
  if (!s) return "";
  const both = o => `${esc(loc(o))}${L() !== "ja" ? `<span class="ja">${esc(o.ja)}</span>` : ""}`;
  return `<section class="card situation">
    ${compact ? "" : `<h2>${bi("situation")}</h2><p>${both(s.you)}</p>`}
    <p class="${compact ? "" : "big"}">${both(s.now)}</p>
    <h2>${bi("todo")}</h2>
    <ol class="todo">${s.todo.map(x => `<li>${both(x)}</li>`).join("")}</ol>
  </section>`;
}

function renderPrep(sc) {
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
    <button id="start" class="primary big">${bi("start")}</button>`);
  $app.querySelector(".back").onclick = renderHome;
  document.getElementById("furi").onchange = e => { S.setFurigana(e.target.checked); renderPrep(sc); };
  document.getElementById("start").onclick = () => renderTalk(sc);
}

// ───── 本番の会話 ─────
function systemFor(sc) {
  const nick = S.getProfile()?.nickname || "学習者";
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
- 小さな文法の間違いは会話の中では直さない（あとで直す）。場面に合っていない内容のときだけ指摘する。

# 話し方
- 日本語だけで話す。学習者に合わせて、短い文で、少しゆっくり話す。1回に1つだけ質問する。
- 学習者の間違いは、会話の中では直さない（あとで別に直す）。意味が分からないときだけ聞き返す。
- 目標が達成されたら、役として自然に会話を終える。
- 最初の一言は「${sc.opening_line}」。
- 丸かっこ（ ）の中の文は、学習者が画面のボタンを押した合図。声に出して読まず、その指示に従う。`;
}

function renderTalk(sc) {
  const key = S.getKey();
  if (!key) { alert(t("noKey")); renderSettings(); return; }
  const transcript = [];          // { who, text }
  const usage = [];               // Live の usageMetadata（原価の実測用）
  let hintIdx = 0, timer = null, finished = false;
  show(`
    <div class="talk">
      <div class="row between"><h1>${esc(sceneTitle(sc))}</h1><span id="clock" class="clock">5:00</span></div>
      <p id="status" class="status">${esc(t("connecting"))}</p>
      <details class="sitbox" open><summary>${esc(t("situation"))}・${esc(t("todo"))}</summary>${situationHtml(sc, true)}</details>
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
  const statusText = { listening: "listening", "mic-denied": "micDenied", "time-up": "timeUp", closed: "error" };

  startConversation({
    key, systemText: systemFor(sc),
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
  S.addSession({ scene: sc.id, at: new Date().toISOString(), seconds: Math.round(seconds), transcript, feedback: fb,
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
      <p class="better">${sayBtn(f.better)}${esc(t("better"))}：<b>${esc(f.better)}</b></p>
      ${S.getFurigana() ? `<p class="furi">${esc(f.better_furigana)}</p>` : ""}
      <p class="why">${esc(why)}</p>
      ${L() !== "ja" ? `<p class="ja">${esc(f.why_ja)}</p>` : ""}
    </section>
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
      <p class="big">${sayBtn(fix.better)}<b>${esc(fix.better)}</b></p>
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

function renderDrill(list, i) {
  if (i >= list.length) { renderHome(); return; }
  const d = list[i];
  const rate = d.style === "早口" || d.style === "略語" ? 1.3 : 1.1;   // 現場の速さに近づける
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
      <details id="reveal"><summary class="note">${esc(t("showText"))}</summary><p class="big">${esc(d.say)}</p></details>
      <p class="note">💡 ${esc(t("askTip"))}</p>
    </section>
    <button id="mic" class="primary big">🎙 ${esc(t("speak"))}</button>
    <form id="typeForm" class="row"><input id="typeBox" placeholder="${esc(t("typeHere"))}"><button class="sub">${esc(t("send"))}</button></form>
    <div id="res"></div>`);
  $app.querySelector(".back").onclick = renderHome;
  document.getElementById("play").onclick = () => { log.replays++; speak(d.say, rate); };
  document.getElementById("slow").onclick = () => { log.slow++; speak(d.say, 0.75); };
  document.getElementById("reveal").ontoggle = e => { if (e.target.open) log.revealed = true; };
  setTimeout(() => { log.replays++; speak(d.say, rate); }, 400);   // 最初に1回、自動で流す
  const $res = document.getElementById("res");
  const judge = async said => {
    if (!said) { $res.innerHTML = `<p class="status">${esc(t("notHeard"))}</p>`; return; }
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
          <p class="better">${sayBtn(d.model)}${esc(t("modelAnswer"))}：<b>${esc(d.model)}</b></p>
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
    <section id="ans" class="card" hidden><p class="big">${sayBtn(c.better)}<b>${esc(c.better)}</b></p>
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
      ${sessions.map(s => `<tr><td>${esc(s.at.slice(5, 16).replace("T", " "))}</td><td>${esc(s.type === "drill" ? "👂 " + s.drill : SCENES.find(x => x.id === s.scene)?.title_ja.slice(0, 10) || s.scene)}</td>
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
