// 文字のAI（Flash-Lite）でやること：会話のあとの「直し」と、言い直しの判定。
// 声の会話より原価がずっと安いので、準備・直し・復習は文字で行う。

export const TEXT_MODEL = "gemini-3.5-flash-lite";
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
- 直すところがない場合は fix.said を空にして、better に次に挑戦するとよい一文を入れる
- model_lines: 学習者の発言を1つずつ順番に、この場面で自然で丁寧な正しい日本語に直したもの（said=学習者が言った文、correct=正しい日本語、furigana=correctの全文ひらがな）。直す必要がない文も correct に入れる。学習者が言うべきだったのに言わなかった大事な一言（達成条件に必要なもの）があれば、said を空にして最後に足す`;
  const schema = {
    type: "OBJECT",
    properties: {
      goal_achieved: { type: "BOOLEAN" },
      ratings: { type: "OBJECT", properties: { goal: { type: "INTEGER" }, polite: { type: "INTEGER" }, correct: { type: "INTEGER" }, smooth: { type: "INTEGER" } }, required: ["goal", "polite", "correct", "smooth"] },
      praise: { type: "STRING" },
      fix: { type: "OBJECT", properties: { said: { type: "STRING" }, better: { type: "STRING" }, better_furigana: { type: "STRING" }, better_meaning: { type: "STRING" }, why_ja: { type: "STRING" }, why: { type: "STRING" } }, required: ["said", "better", "better_furigana", "better_meaning", "why_ja", "why"] },
      model_lines: { type: "ARRAY", items: { type: "OBJECT", properties: { said: { type: "STRING" }, correct: { type: "STRING" }, furigana: { type: "STRING" } }, required: ["said", "correct", "furigana"] } },
    },
    required: ["goal_achieved", "ratings", "praise", "fix", "model_lines"],
  };
  return generate(key, prompt, schema);
}

// 自然な日本人の声で読み上げる（GeminiのTTS）。話し方（早口・関西弁など）も言葉で指定する。
// 返り値は再生用の { pcm: Int16Array, rate } か WAV の ArrayBuffer
export const TTS_MODEL = "gemini-3.8-flash-lite-tts";
export async function tts(key, text, style, voice) {
  const res = await fetch(`${URL_BASE}/${TTS_MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: style ? `${style}：${text}` : text }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || "Kore" } } } },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = await res.json();
  const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part) throw new Error("no audio");
  const bin = atob(part.inlineData.data), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const mime = part.inlineData.mimeType || "";
  const rate = +(mime.match(/rate=(\d+)/)?.[1] || 24000);
  const isWav = bin.slice(0, 4) === "RIFF";
  return { bytes, rate, isWav };
}

// 会話の手助け（段階）の材料：「やること」1つずつに、全文・骨組み・キーワード・まちがいの選択肢を作る
export function makeScaffold(key, scene, situation, lang) {
  const prompt = `外国人の日本語学習者（目安 ${scene.level}）が、次のロールプレイで言う文の練習材料を作ってください。
場面: ${scene.title_ja}
相手の役: ${scene.ai_role}
学習者の状況: ${situation.you.ja} ${situation.now.ja}
学習者がやること（順番）: ${situation.todo.map((x, i) => `${i + 1}. ${x.ja}`).join(" / ")}
参考の表現: ${scene.key_phrases.map(p => p.ja).join(" / ")}

やること1つずつに:
- full: この状況で学習者が言う、自然で丁寧な1文（短く。状況の人名・時間・数字に合わせる）
- furigana: full の全文ひらがな
- skeleton: full の大事な部分（数字・場所・動詞など2〜3か所）を「＿＿」にした文
- keywords: 言うときのヒントになる語を2〜4個（日本語）
- wrong: full と似ているが、この場面では不適切な文を2つ（丁寧さが足りない、内容が状況と違う、文法がおかしい など。理由が分かる程度に）
- meaning: full の意味を${{ ja: "English", en: "English", vi: "Vietnamese" }[lang] || "English"}で`;
  const schema = {
    type: "OBJECT",
    properties: { steps: { type: "ARRAY", items: { type: "OBJECT", properties: {
      full: { type: "STRING" }, furigana: { type: "STRING" }, skeleton: { type: "STRING" },
      keywords: { type: "ARRAY", items: { type: "STRING" } }, wrong: { type: "ARRAY", items: { type: "STRING" } }, meaning: { type: "STRING" },
    }, required: ["full", "furigana", "skeleton", "keywords", "wrong", "meaning"] } } },
    required: ["steps"],
  };
  return generate(key, prompt, schema);
}

// 「聞いて くりかえす」の判定：復唱に必要な情報が入っているか、足りない指示では聞き返せたか
export function judgeDrill(key, drill, said, lang) {
  const isAsk = drill.kind === "ask";
  const prompt = `外国人の働く人が、職場で日本人から次の指示を聞きました（${drill.speaker}、${drill.style}）。
指示: 「${drill.say}」
${isAsk
  ? `この指示は情報が足りないので、正しい対応は「聞き返す」こと。聞き返すべき点: ${drill.ask.join(" / ")}
学習者が、足りない点を1つ以上、丁寧に聞き返せていれば ok=true（「わかりました」「はい」だけなら ok=false。わかったふりは一番危ない）。`
  : `正しい対応は、大事な情報を復唱して確かめること。必ず入れる情報: ${drill.slots.join(" / ")}
すべての情報が正しく入っていれば ok=true。数字・場所・時間の間違いは ok=false。「わかりました」だけで復唱していなければ ok=false。`}
学習者の返事（音声の文字起こしまたは入力。句読点や漢字の違いは気にしない）: 「${said}」
- checks: ${isAsk ? "聞き返すべき点" : "必ず入れる情報"}ごとに、言えたか（ok）
- comment_ja: やさしい日本語で、できたことをほめてから、足りない点を1つ（50字以内）
- comment: 同じ内容を${{ ja: "やさしい日本語", en: "English", vi: "Vietnamese" }[lang] || "English"}で`;
  const schema = {
    type: "OBJECT",
    properties: {
      ok: { type: "BOOLEAN" },
      checks: { type: "ARRAY", items: { type: "OBJECT", properties: { item: { type: "STRING" }, ok: { type: "BOOLEAN" } }, required: ["item", "ok"] } },
      comment_ja: { type: "STRING" }, comment: { type: "STRING" },
    },
    required: ["ok", "checks", "comment_ja", "comment"],
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
