// 文字のAI（Flash-Lite）でやること：会話のあとの「直し」と、言い直しの判定。
// 声の会話より原価がずっと安いので、準備・直し・復習は文字で行う。

export const TEXT_MODEL = "gemini-flash-lite-latest";
const URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

async function generate(key, prompt, schema) {
  const res = await fetch(`${URL_BASE}/${TEXT_MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.3 },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "{}";
  return { result: JSON.parse(text), usage: data.usageMetadata || {} };
}

const LANG_NAME = { ja: "やさしい日本語", en: "English", vi: "Vietnamese" };

// 会話の文字記録から、目標の達成・4つの観点・いちばん大事な直し1つを作る
export function makeFeedback(key, scene, transcript, lang) {
  const lines = transcript.map(m => `${m.who === "me" ? "学習者" : "相手"}: ${m.text}`).join("\n");
  const prompt = `あなたは外国人に職場の日本語を教える、やさしい日本語教師です。医療・法律・在留手続きの助言はしません。学習者を責めず、できたことをまずほめます。
場面: ${scene.title_ja}
今日の目標: ${scene.goal_ja}
目標の達成条件: ${scene.goal_check.join(" / ")}

会話（音声の文字起こし。誤認識を含むことがある。認識の誤りらしい箇所は学習者の誤りとして扱わない）:
${lines || "（会話なし）"}

次を出してください。
- goal_achieved: 達成条件をすべて満たしたか
- ratings: 目標・ていねいさ・正確さ・なめらかさを1〜3で（3が良い）
- praise: 具体的にほめる一言（やさしい日本語、30字以内）
- fix: 学習者の発言から、いちばん大事な直しを1つだけ。said=学習者が言った文、better=自然で丁寧な言い方（短く）、better_furigana=betterの全文ひらがな、better_meaning=betterの意味を${LANG_NAME[lang] === "やさしい日本語" ? "English" : LANG_NAME[lang] || "English"}で、why_ja=理由（やさしい日本語、40字以内）、why=理由を${LANG_NAME[lang] || "English"}で
- 直すところがない場合は fix.said を空にして、better に次に挑戦するとよい一文を入れる`;
  const schema = {
    type: "OBJECT",
    properties: {
      goal_achieved: { type: "BOOLEAN" },
      ratings: { type: "OBJECT", properties: { goal: { type: "INTEGER" }, polite: { type: "INTEGER" }, correct: { type: "INTEGER" }, smooth: { type: "INTEGER" } }, required: ["goal", "polite", "correct", "smooth"] },
      praise: { type: "STRING" },
      fix: { type: "OBJECT", properties: { said: { type: "STRING" }, better: { type: "STRING" }, better_furigana: { type: "STRING" }, better_meaning: { type: "STRING" }, why_ja: { type: "STRING" }, why: { type: "STRING" } }, required: ["said", "better", "better_furigana", "better_meaning", "why_ja", "why"] },
    },
    required: ["goal_achieved", "ratings", "praise", "fix"],
  };
  return generate(key, prompt, schema);
}

// 言い直し・復習の判定：言いたい文と、学習者が実際に言った（または入力した）文を比べる
export function judgeRetry(key, target, said) {
  const prompt = `外国人の日本語学習者が、次の文を言う練習をしました。
言うべき文: ${target}
実際に言った文（音声の文字起こし、または入力）: ${said}
意味と大事な言い方（丁寧さ・助詞・動詞の形）が合っていれば ok=true。文字起こしの細かい違い（句読点、漢字かひらがなか、言いよどみ）は気にしない。
comment はやさしい日本語で20字以内。`;
  const schema = { type: "OBJECT", properties: { ok: { type: "BOOLEAN" }, comment: { type: "STRING" } }, required: ["ok", "comment"] };
  return generate(key, prompt, schema);
}
