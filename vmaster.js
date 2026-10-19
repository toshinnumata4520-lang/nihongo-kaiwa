// JLPT 単語の「おぼえた」記録。端末の中だけに保存する。
// 1語ごとに ★0〜3：0＝まだ / 1＝あと少し / 2＝おぼえた / 3＝身についた。
// ★は「日をあけて」正解すると上がる（★1→★2 は次の日以降、★2→★3 は3日後以降）。同じ日に何回正解しても1つまで。
// まちがえたら ★を1つ下げる（0より下はない）。日をあけて思い出すことで、長く覚えていられるようにするため。
// ユニット（20語）：★2以上が8割になると「ユニットチェック」を受けられ、9割で合格 → 次のユニットがひらく。
// レベル認定テスト：そのレベルの全ユニットに合格したら受けられる。9割で「認定」。★3が9割をこえると「身についた」。
// 実力チェック：はじめに力をはかる。正解した語は ★1 から始められる。
const KEY = "nk.vm";
export const PASS = 0.9;           // ユニットチェック・レベル認定テストの合格ライン
export const UNLOCK = 0.8;         // ユニットチェックを受けられる「おぼえた」の割合
export const LEVEL_Q = 40;         // レベル認定テスト・実力チェックの問題数（語数が少ないときは全部）
const WAIT = [0, 1, 3];            // ★n から ★n+1 に上がるまでに、あける日数（★0→1 は すぐ）

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = st => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
const fresh = st => ({ w: {}, unit: {}, level: {}, days: {}, ...st });
const dayNo = (t = Date.now()) => { const d = new Date(t); return Math.floor((d - d.getTimezoneOffset() * 60000) / 86400000); };   // 端末の日付で数える

export const stars = id => fresh(load()).w[id]?.s || 0;
export const unitPassed = key => !!fresh(load()).unit[key];
export const levelState = lv => fresh(load()).level[lv] || {};

// 答えを記録する。返り値は新しい★
export function record(id, ok) {
  const st = fresh(load());
  const w = st.w[id] || { s: 0 };
  const today = dayNo();
  if (!ok) w.s = Math.max(0, w.s - 1);
  else if (w.s < 3 && today - (w.up ?? -99) >= WAIT[w.s] && today !== w.up) { w.s++; w.up = today; }   // 前に★が上がった日から数える
  if (ok) w.day = today;
  st.w[id] = w;
  st.days[today] = (st.days[today] || 0) + 1;
  save(st);
  return w.s;
}
// 実力チェックで正解した語は ★1 から
export function head(id) { const st = fresh(load()); const w = st.w[id] || { s: 0 }; if (w.s < 1) { w.s = 1; w.day = w.up = dayNo(); } st.w[id] = w; save(st); }
// ★が上がるのを待っている語（あした以降にもう一度）
export function waiting(id) { const w = fresh(load()).w[id]; return !!w && w.s > 0 && w.s < 3 && dayNo() - (w.up ?? -99) < WAIT[w.s]; }

export const todayCount = () => fresh(load()).days[dayNo()] || 0;
export function streak() { const d = fresh(load()).days; let n = 0, t = dayNo(); if (!d[t]) t--; while (d[t]) { n++; t--; } return n; }
export function passUnit(key) { const st = fresh(load()); st.unit[key] = Date.now(); save(st); }
export function passLevel(lv) { const st = fresh(load()); st.level[lv] = { ...(st.level[lv] || {}), cert: Date.now() }; save(st); }
