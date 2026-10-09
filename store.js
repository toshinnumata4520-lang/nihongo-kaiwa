// 端末内の記録（試作版）。会社への報告やサーバー保存は、本格版で作る。
const K = { profile: "nk.profile", key: "nk.devkey", sessions: "nk.sessions", cards: "nk.cards", furigana: "nk.furigana" };
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
// 保存できない（容量が一杯・ブラウザの設定で禁止）ときも、例外でアプリを止めない
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.warn("storage", e); return false; } };
const getRaw = k => { try { return localStorage.getItem(k); } catch { return null; } };

export const getProfile = () => read(K.profile, null);
export const setProfile = p => write(K.profile, p);
export const getKey = () => getRaw(K.key) || "";
export const setKey = v => { try { v.trim() ? localStorage.setItem(K.key, v.trim()) : localStorage.removeItem(K.key); } catch {} };
export const getFurigana = () => read(K.furigana, true);
export const setFurigana = v => write(K.furigana, v);

// 1回の練習の記録：場面・日時・時間・会話・評価・AIの使用量（原価の実測用）
export const getSessions = () => read(K.sessions, []);
// 新しい30件は全部残し、それより古いものは会話の全文と使用量の明細を落とす（端末の保存容量 約5MB を超えないように）
export function addSession(s) {
  const all = getSessions(); all.push(s);
  const slim = all.slice(-500).map((x, i, a) => i < a.length - 30 ? { ...x, transcript: undefined, usage: undefined, results: undefined } : x);
  if (!write(K.sessions, slim)) write(K.sessions, slim.slice(-50));
}

// 場面ごとの段階：未挑戦 → 練習中 → できた（目標達成が2回続く）→ すらすら（3回続けて、なめらかさ3）
export function sceneStatus(sceneId) {
  const list = getSessions().filter(s => s.scene === sceneId && s.feedback);
  if (!list.length) return "new";
  const last = list.slice(-3);
  if (last.length === 3 && last.every(s => s.feedback.goal_achieved && s.feedback.ratings?.smooth >= 3)) return "fluent";
  const last2 = list.slice(-2);
  if (last2.length === 2 && last2.every(s => s.feedback.goal_achieved)) return "done";
  return "trying";
}

// 日付は端末の現地時間で数える（世界標準時だと、日本の朝9時前が前日扱いになる）
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function practiceDays() {
  return new Set(getSessions().map(s => localDate(new Date(s.at)))).size;
}

// 復習カード：直した言い方を、翌日・3日後・1週間後に出す
const STEPS = [1, 3, 7];
export const getCards = () => read(K.cards, []);
export function addCard(card) {
  const cards = getCards();
  // 同じ文のカードがあれば、ふやさずに最初から復習しなおす
  const same = cards.find(c => c.better === card.better);
  if (same) { same.step = 0; same.due = addDays(new Date(), STEPS[0]); write(K.cards, cards); return; }
  cards.push({ ...card, id: Date.now().toString(36), step: 0, due: addDays(new Date(), STEPS[0]) });
  write(K.cards, cards);
}
export function dueCards() {
  const today = localDate();
  return getCards().filter(c => c.step < STEPS.length && c.due <= today);
}
export function gradeCard(id, ok) {
  const cards = getCards();
  const c = cards.find(x => x.id === id);
  if (!c) return;
  if (ok) { c.step++; if (c.step < STEPS.length) c.due = addDays(new Date(), STEPS[c.step]); }
  else c.due = addDays(new Date(), 1);
  write(K.cards, cards);
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return localDate(x); }

export function clearAll() {
  try {
    for (const k of Object.values(K)) if (k !== K.key) localStorage.removeItem(k);
    Object.keys(localStorage).filter(k => k.startsWith("nk.level.") || k.startsWith("nk.scaf.")).forEach(k => localStorage.removeItem(k));
  } catch {}
}
