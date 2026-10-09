// 場面データ（教材担当の作成。ベトナム語は母語話者の確認待ち。飲食・工場・建設の用語は現場の確認待ち）
export const SCENES = [
  {
    "id": "work_late_call",
    "title_ja": "職場：遅刻の連絡（上司に電話）",
    "title_furigana": "しょくば：ちこくのれんらく（じょうしにでんわ）",
    "title": {
      "en": "Workplace: Calling your boss to say you'll be late",
      "vi": "Nơi làm việc: Gọi điện báo cấp trên rằng mình sẽ đến muộn"
    },
    "level": "N4",
    "goal_ja": "遅れるときに、上司に電話で理由と着く時間を伝えて、きちんと謝ることができる。",
    "goal": {
      "en": "I can call my boss, explain why I'll be late and when I'll arrive, and apologize properly.",
      "vi": "Tôi có thể gọi điện cho cấp trên, nói lý do đến muộn, giờ sẽ đến và xin lỗi đúng cách."
    },
    "goal_check": [
      "自分の名前を言ってから、遅れることを伝えた（例：「〇〇です。すみません、遅れます」）",
      "遅れる理由と、着く時間（何分ぐらい・何時ごろ）の両方を言った",
      "謝る言葉（すみません／申し訳ありません）を言い、上司の指示に「わかりました」などで返事をした"
    ],
    "ai_role": "学習者の職場の上司・山田さん（40代、班長）。少し忙しいが、怒らずに落ち着いて話す。話し方は普通体まじりの丁寧語（「どうしたの？」「何時ごろ来られる？」程度）。理由や時間を言わなかったら「何分ぐらい遅れそう？」「どうしたの？」と自然に聞き返す。最後に「気をつけて来てね。着いたら声をかけて」などの指示を1つ出す。",
    "opening_line": "はい、山田です。",
    "key_phrases": [
      {
        "ja": "すみません、電車が遅れていて、10分ぐらい遅れます。",
        "furigana": "すみません、でんしゃがおくれていて、じゅっぷんぐらいおくれます。",
        "romaji": "Sumimasen, densha ga okurete ite, juppun gurai okuremasu.",
        "en": "I'm sorry, the train is delayed, so I'll be about 10 minutes late.",
        "vi": "Xin lỗi, tàu đang bị trễ nên tôi sẽ đến muộn khoảng 10 phút."
      },
      {
        "ja": "9時10分ごろ着くと思います。",
        "furigana": "くじじゅっぷんごろつくとおもいます。",
        "romaji": "Ku-ji juppun goro tsuku to omoimasu.",
        "en": "I think I'll arrive around 9:10.",
        "vi": "Tôi nghĩ tôi sẽ đến vào khoảng 9 giờ 10 phút."
      },
      {
        "ja": "ご迷惑をおかけして、申し訳ありません。",
        "furigana": "ごめいわくをおかけして、もうしわけありません。",
        "romaji": "Go-meiwaku o okake shite, mōshiwake arimasen.",
        "en": "I'm very sorry for causing you trouble.",
        "vi": "Tôi thành thật xin lỗi vì đã gây phiền hà cho anh/chị."
      }
    ],
    "hints": [
      "まず、あなたの なまえを いいましょう。「〇〇です。」",
      "どうして おくれますか。「でんしゃが おくれて います」「ねぼうしました」などと いいましょう。",
      "なんじに つきますか。「〇じ〇ふんごろ つきます」と いいましょう。さいごに「すみません」も いいましょう。"
    ],
    "common_errors": [
      {
        "wrong": "遅れるです。",
        "correct": "遅れます。",
        "why": "動詞に「です」はつけない。丁寧にするときは「ます形」を使う。"
      },
      {
        "wrong": "電車が遅いです。",
        "correct": "電車が遅れています。",
        "why": "「遅い」はスピードがゆっくりという意味。時間どおりに来ないときは「遅れている」。"
      },
      {
        "wrong": "（理由も時間も言わずに）すみません、遅刻します。",
        "correct": "すみません、電車が遅れていて、9時10分ごろ着きます。",
        "why": "上司は準備のために「なぜ」と「いつ着くか」を知りたい。理由と時間をセットで伝える。"
      }
    ],
    "safety_note": "練習用の架空の職場です。実際の遅刻・欠勤の連絡方法（電話かチャットか、だれに、何時までに）は会社のルールに従うよう、復習画面で一言添える。AIは「遅刻したら解雇される」など労働条件についての判断や助言はしない。"
  },
  {
    "id": "life_konbini_pay",
    "title_ja": "コンビニ：支払いと温め・袋",
    "title_furigana": "こんびに：しはらいとあたため・ふくろ",
    "title": {
      "en": "Convenience store: Paying, heating food, and bags",
      "vi": "Cửa hàng tiện lợi: Thanh toán, hâm nóng đồ ăn và túi"
    },
    "level": "N4",
    "goal_ja": "コンビニのレジで、店員の質問（温め・袋・支払い方法など）に答えて、買い物を終えることができる。",
    "goal": {
      "en": "I can answer the clerk's questions (heating, bag, payment method) and finish my purchase at a convenience store.",
      "vi": "Tôi có thể trả lời câu hỏi của nhân viên (hâm nóng, túi, cách thanh toán) và hoàn tất việc mua hàng ở cửa hàng tiện lợi."
    },
    "goal_check": [
      "「温めますか」に、温めてほしいか、いらないかをはっきり答えた",
      "袋が必要かどうかを、誤解のない言い方で答えた（「袋はいりません」「袋をください」など）",
      "支払い方法（現金・カード・スマホ決済など）を伝えて、支払いを終えた"
    ],
    "ai_role": "コンビニの店員（20代、アルバイト）。明るく少し早口で、接客の決まり文句を使う（「お弁当温めますか」「袋はご利用ですか」「お支払いは？」）。学習者が詰まったら、1回目はふつうの速さでくり返し、2回目は短くゆっくり言いかえる（例：「袋、いりますか？」）。ポイントカードか箸の質問も1つ入れる。",
    "opening_line": "いらっしゃいませ。こちらのお弁当、温めますか。",
    "key_phrases": [
      {
        "ja": "はい、温めてください。",
        "furigana": "はい、あたためてください。",
        "romaji": "Hai, atatamete kudasai.",
        "en": "Yes, please heat it up.",
        "vi": "Vâng, làm ơn hâm nóng giúp tôi."
      },
      {
        "ja": "袋はいりません。",
        "furigana": "ふくろはいりません。",
        "romaji": "Fukuro wa irimasen.",
        "en": "I don't need a bag.",
        "vi": "Tôi không cần túi."
      },
      {
        "ja": "カードで払えますか。",
        "furigana": "かーどではらえますか。",
        "romaji": "Kādo de haraemasu ka.",
        "en": "Can I pay by card?",
        "vi": "Tôi có thể trả bằng thẻ không?"
      }
    ],
    "hints": [
      "「あたためますか」は「あつく しますか」と いう いみです。「はい、おねがいします」か「いいえ、けっこうです」と いいましょう。",
      "ふくろが ほしい ときは「ふくろを ください」、いらない ときは「ふくろは いりません」と いいましょう。",
      "おかねの はらいかたを いいましょう。「げんきんで」「かーどで」「すまほで おねがいします」。"
    ],
    "common_errors": [
      {
        "wrong": "温めるください。",
        "correct": "温めてください。",
        "why": "「ください」の前は「て形」にする（温める→温めて）。"
      },
      {
        "wrong": "（袋はいりますか？に）大丈夫です。",
        "correct": "袋はいりません。／袋をお願いします。",
        "why": "「大丈夫です」は「いらない」とも「ほしい」とも取れて誤解されやすい。はっきり言うほうが安全。"
      },
      {
        "wrong": "（ポイントカードはお持ちですか？に、持っていないのに）はい。",
        "correct": "いいえ、持っていません。",
        "why": "聞き取れないまま「はい」と答えるとやりとりが止まる。わからないときは「もう一度お願いします」と言う。"
      }
    ],
    "safety_note": "練習用の会話です。AIは実在の店名・決済サービスの宣伝をせず、カード番号・暗証番号などの個人情報を求めない。学習者が本物のカード番号などを言いそうになったら「練習なので言わなくて大丈夫です」と止める。"
  },
  {
    "id": "life_clinic_first_visit",
    "title_ja": "病院の受付：初診で症状を伝える",
    "title_furigana": "びょういんのうけつけ：しょしんでしょうじょうをつたえる",
    "title": {
      "en": "Clinic reception: Explaining your symptoms on a first visit",
      "vi": "Quầy lễ tân phòng khám: Nói triệu chứng khi khám lần đầu"
    },
    "level": "N3",
    "goal_ja": "初めて行く病院の受付で、保険証を出し、いつから・どこが・どのようにつらいかを伝えることができる。",
    "goal": {
      "en": "At a clinic I'm visiting for the first time, I can show my insurance card and explain since when, where, and how I feel unwell.",
      "vi": "Ở phòng khám lần đầu đến, tôi có thể đưa thẻ bảo hiểm và nói triệu chứng: từ khi nào, ở đâu và như thế nào."
    },
    "goal_check": [
      "初めて来たことを伝え、保険証（マイナ保険証）を出す、または持っているかを答えた",
      "症状を「いつから」と「どこが・どうなっているか」の2つを入れて言った（例：「昨日の夜から熱があって、のどが痛いです」）",
      "アレルギーなど受付の質問に答え、問診票の記入や待つ指示を理解して返事をした"
    ],
    "ai_role": "内科クリニックの受付スタッフ（30代）。やさしく落ち着いた丁寧語（「どうされましたか」「こちらにご記入ください」）。医療者ではなく受付なので、診断や薬の説明はしない。症状の説明があいまいなら「いつからですか」「熱は何度ありましたか」と1つずつ質問する。最後に「お名前をお呼びしますので、おかけになってお待ちください」と案内する。",
    "opening_line": "こんにちは。こちらは初めてですか。",
    "key_phrases": [
      {
        "ja": "初めてです。保険証はこれです。",
        "furigana": "はじめてです。ほけんしょうはこれです。",
        "romaji": "Hajimete desu. Hokenshō wa kore desu.",
        "en": "It's my first time. Here is my health insurance card.",
        "vi": "Đây là lần đầu tiên tôi đến. Đây là thẻ bảo hiểm y tế của tôi."
      },
      {
        "ja": "昨日の夜から熱があって、のどが痛いです。",
        "furigana": "きのうのよるからねつがあって、のどがいたいです。",
        "romaji": "Kinō no yoru kara netsu ga atte, nodo ga itai desu.",
        "en": "I've had a fever since last night, and my throat hurts.",
        "vi": "Tôi bị sốt từ tối hôm qua và bị đau họng."
      },
      {
        "ja": "薬のアレルギーはありません。",
        "furigana": "くすりのあれるぎーはありません。",
        "romaji": "Kusuri no arerugī wa arimasen.",
        "en": "I don't have any drug allergies.",
        "vi": "Tôi không bị dị ứng thuốc."
      }
    ],
    "hints": [
      "まず「はじめてです」と いって、ほけんしょうを だしましょう。",
      "「いつから」と「どこが いたいか」を いいましょう。「きのうから あたまが いたいです」。",
      "わからない ことばが あったら「すみません、もう いちど ゆっくり おねがいします」と いいましょう。"
    ],
    "common_errors": [
      {
        "wrong": "熱です。頭が痛いです。",
        "correct": "昨日から熱があって、頭が痛いです。",
        "why": "「熱がある」と言う。症状は「〜て、〜」でつなげ、「いつから」を入れると伝わりやすい。"
      },
      {
        "wrong": "お腹が痛いがあります。",
        "correct": "お腹が痛いです。／腹痛があります。",
        "why": "「痛い」は形容詞なので「があります」はつかない。名詞（腹痛・せき・熱）なら「があります」。"
      },
      {
        "wrong": "昨日に熱が出ました。",
        "correct": "昨日、熱が出ました。／昨日から熱があります。",
        "why": "「昨日・今朝」などには「に」をつけない。続いている症状は「から」を使う。"
      }
    ],
    "safety_note": "AIは受付役に徹し、病名の推測・薬の飲み方・受診すべきかどうかなど医療の助言を一切しない。学習者が胸の痛み・息が苦しい・意識がもうろうとする等、実際に具合が悪いと思われる発言をしたら役を止めて「これは練習です。本当に具合が悪いときは病院へ。急ぐときは119番、迷うときは#7119などの相談窓口に電話してください」と案内する。名前・生年月日・保険証番号は架空のものを使い、本物の個人情報は求めない。"
  },
  {
    "id": "hotel_check_in",
    "title_ja": "旅館・ホテル：フロントでチェックインの対応をする",
    "title_furigana": "りょかん・ほてる：ふろんとでちぇっくいんのたいおうをする",
    "title": {
      "en": "Hotel/Ryokan: Handling check-in at the front desk",
      "vi": "Khách sạn/Ryokan: Làm thủ tục nhận phòng tại quầy lễ tân"
    },
    "level": "N3",
    "goal_ja": "フロントで予約の名前を確認し、朝食の時間などを案内して、チェックインの対応ができる。",
    "goal": {
      "en": "I can confirm the reservation name, explain things like breakfast times, and handle check-in at the front desk.",
      "vi": "Tôi có thể xác nhận tên đặt phòng, hướng dẫn giờ ăn sáng và làm thủ tục nhận phòng tại quầy lễ tân."
    },
    "goal_check": [
      "予約の名前を丁寧に聞いて確認した（「お名前を伺ってもよろしいですか」など）",
      "朝食・お風呂などの案内を1つ以上、時間と場所を入れて言えた",
      "お客様の質問（チェックアウトの時間など）に答えるか、わからなければ確認すると伝えた"
    ],
    "ai_role": "旅館・ビジネスホテルの宿泊客（60代の日本人男性、観光）。落ち着いたふつうの丁寧語。予約名は「鈴木」。途中で「チェックアウトは何時ですか」か「大浴場は何時まで入れますか」のどちらかを聞く。学習者の敬語が少しまちがっていても怒らないが、聞き取れないときは「え？」と聞き返す。",
    "opening_line": "すみません、今日予約している鈴木ですが。",
    "key_phrases": [
      {
        "ja": "ご予約のお名前を伺ってもよろしいですか。",
        "furigana": "ごよやくのおなまえをうかがってもよろしいですか。",
        "romaji": "Go-yoyaku no o-namae o ukagatte mo yoroshii desu ka.",
        "en": "May I have the name on the reservation?",
        "vi": "Xin cho tôi hỏi tên người đặt phòng được không ạ?"
      },
      {
        "ja": "朝食は7時から9時半まで、2階のレストランでございます。",
        "furigana": "ちょうしょくはしちじからくじはんまで、にかいのれすとらんでございます。",
        "romaji": "Chōshoku wa shichi-ji kara ku-ji han made, ni-kai no resutoran de gozaimasu.",
        "en": "Breakfast is served from 7:00 to 9:30 at the restaurant on the 2nd floor.",
        "vi": "Bữa sáng được phục vụ từ 7 giờ đến 9 giờ 30 tại nhà hàng ở tầng 2 ạ."
      },
      {
        "ja": "何かございましたら、フロントまでお電話ください。",
        "furigana": "なにかございましたら、ふろんとまでおでんわください。",
        "romaji": "Nani ka gozaimashitara, furonto made o-denwa kudasai.",
        "en": "If you need anything, please call the front desk.",
        "vi": "Nếu có việc gì, xin quý khách vui lòng gọi điện cho quầy lễ tân ạ."
      }
    ],
    "hints": [
      "まず なまえを ききましょう。「おなまえを うかがっても よろしいですか」。",
      "あんないは「じかん」と「ばしょ」を いいましょう。「7じから 9じはんまで、2かいです」。",
      "わからない ときは「かくにん いたします。しょうしょう おまちください」と いいましょう。"
    ],
    "common_errors": [
      {
        "wrong": "お名前は何ですか。",
        "correct": "お名前を伺ってもよろしいですか。",
        "why": "「何ですか」は直接的すぎる。お客様には「伺う（聞くの謙譲語）」を使う。"
      },
      {
        "wrong": "朝ご飯は2階のレストランにございます。",
        "correct": "朝食は2階のレストランでございます。",
        "why": "「〜にございます」は物がある場所。食事をする場所の案内は「〜でございます」。ホテルでは「朝食」が自然。"
      },
      {
        "wrong": "鈴木様でございますか。",
        "correct": "鈴木様でいらっしゃいますか。",
        "why": "「ございます」は自分側・物に使う丁寧語。お客様本人には尊敬語「いらっしゃいます」を使う。"
      }
    ],
    "safety_note": "練習用の架空の宿です。AIは実在の宿泊施設名を使わない。宿泊者名簿の記入・旅券の確認など法令や会社で決まった手続きは職場のマニュアルに従うよう、復習画面で添える。学習者に本物の個人情報を入力させない。"
  },
  {
    "id": "food_take_order",
    "title_ja": "飲食：注文を受けて、アレルギーの質問に対応する",
    "title_furigana": "いんしょく：ちゅうもんをうけて、あれるぎーのしつもんにたいおうする",
    "title": {
      "en": "Restaurant: Taking an order and handling an allergy question",
      "vi": "Nhà hàng: Nhận gọi món và xử lý câu hỏi về dị ứng"
    },
    "level": "N3",
    "goal_ja": "お客様の注文を受けて復唱し、自分でわからない質問（アレルギーなど）には「確認します」と言って対応できる。",
    "goal": {
      "en": "I can take and repeat a customer's order, and say \"I'll check\" when I'm asked something I don't know, such as about allergies.",
      "vi": "Tôi có thể nhận và nhắc lại món khách gọi, và nói \"tôi sẽ kiểm tra\" khi được hỏi điều mình không biết, như về dị ứng."
    },
    "goal_check": [
      "注文を聞き、品名と数を復唱して確認した（「ご注文をくり返します」など）",
      "アレルギーの質問に自分の判断で答えず、「確認してまいります」など確認する言い方をした",
      "接客の丁寧な言い方（少々お待ちください／かしこまりました）を1つ以上使った"
    ],
    "ai_role": "定食屋・ファミリーレストランのお客様（30代、子ども連れ）。ふつうの丁寧語。注文は料理2品＋飲み物1つ。途中で「この唐揚げ、卵は入っていますか？子どもがアレルギーで」と質問する。学習者が確認せずに「大丈夫です」と答えたら「本当に大丈夫ですか？」と不安そうに聞き返す。",
    "opening_line": "すみません、注文いいですか。",
    "key_phrases": [
      {
        "ja": "はい、ご注文はお決まりですか。",
        "furigana": "はい、ごちゅうもんはおきまりですか。",
        "romaji": "Hai, go-chūmon wa o-kimari desu ka.",
        "en": "Yes, are you ready to order?",
        "vi": "Vâng, quý khách đã chọn món chưa ạ?"
      },
      {
        "ja": "ご注文をくり返します。",
        "furigana": "ごちゅうもんをくりかえします。",
        "romaji": "Go-chūmon o kurikaeshimasu.",
        "en": "Let me repeat your order.",
        "vi": "Tôi xin nhắc lại các món quý khách đã gọi ạ."
      },
      {
        "ja": "確認してまいりますので、少々お待ちください。",
        "furigana": "かくにんしてまいりますので、しょうしょうおまちください。",
        "romaji": "Kakunin shite mairimasu node, shōshō o-machi kudasai.",
        "en": "I'll go and check, so please wait a moment.",
        "vi": "Tôi sẽ đi kiểm tra, xin quý khách vui lòng đợi một chút ạ."
      }
    ],
    "hints": [
      "ちゅうもんを きいたら、「〇〇を ひとつ、〇〇を ふたつですね」と くりかえしましょう。",
      "わからない ことは じぶんで こたえません。「かくにんして まいります」と いいましょう。",
      "「しょうしょう おまちください」「かしこまりました」を つかいましょう。"
    ],
    "common_errors": [
      {
        "wrong": "（アレルギーの質問に）たぶん大丈夫です。",
        "correct": "確認してまいりますので、少々お待ちください。",
        "why": "アレルギーは命にかかわる。わからないときは推測で答えず、必ず確認する。"
      },
      {
        "wrong": "ちょっと待ってください。",
        "correct": "少々お待ちください。",
        "why": "お客様には「少々お待ちください」。「ちょっと待って」は友だちや同僚への言い方。"
      },
      {
        "wrong": "わかりました。",
        "correct": "かしこまりました。",
        "why": "お客様への返事は「かしこまりました」がより丁寧。同僚・上司への返事なら「わかりました」でよい。"
      }
    ],
    "safety_note": "練習用の架空の店です。AIはどの料理にどのアレルゲンが入っているかを断定しない。正しい対応は「自分で判断せず、店長・厨房・アレルゲン表で確認する」であることを、フィードバックで強調する。"
  },
  {
    "id": "care_report_resident",
    "title_ja": "介護：利用者さんの様子をリーダーに報告する",
    "title_furigana": "かいご：りようしゃさんのようすをりーだーにほうこくする",
    "title": {
      "en": "Caregiving: Reporting a resident's condition to the team leader",
      "vi": "Điều dưỡng: Báo cáo tình trạng của người được chăm sóc cho trưởng nhóm"
    },
    "level": "N3",
    "goal_ja": "利用者さんがいつもと違うと気づいたとき、リーダーに事実（だれが・何が・数字）を正しく報告できる。",
    "goal": {
      "en": "When I notice a resident is not as usual, I can correctly report the facts (who, what, and numbers) to the team leader.",
      "vi": "Khi nhận thấy người được chăm sóc khác với thường ngày, tôi có thể báo cáo chính xác sự việc (ai, chuyện gì, con số) cho trưởng nhóm."
    },
    "goal_check": [
      "利用者さんの名前を最初に言い、報告だとわかる言い方で始めた（「〇〇さんのことですが」など）",
      "いつもと違う点を事実で伝え、数字（食事量・体温など）を1つ以上入れた",
      "リーダーの指示をくり返して確認した（「〜ですね。わかりました」）"
    ],
    "ai_role": "介護施設のフロアリーダー・佐藤さん（50代女性）。経験豊富で面倒見がよい。職場の丁寧語＋ときどき普通体（「そう、何割ぐらい食べた？」「熱は測った？」）。報告に足りない情報があれば1つずつ質問する。最後に「じゃあ、30分後にもう一度熱を測って、記録に書いておいてください」などの指示を出す。",
    "opening_line": "あ、お疲れさま。どうしたの？",
    "key_phrases": [
      {
        "ja": "田中さんのことですが、昼ご飯を半分しか食べませんでした。",
        "furigana": "たなかさんのことですが、ひるごはんをはんぶんしかたべませんでした。",
        "romaji": "Tanaka-san no koto desu ga, hirugohan o hanbun shika tabemasen deshita.",
        "en": "It's about Mr./Ms. Tanaka. They only ate half of their lunch.",
        "vi": "Về bác Tanaka ạ, bác ấy chỉ ăn được một nửa bữa trưa."
      },
      {
        "ja": "顔が少し赤くて、熱を測ったら37度5分でした。",
        "furigana": "かおがすこしあかくて、ねつをはかったらさんじゅうななどごぶでした。",
        "romaji": "Kao ga sukoshi akakute, netsu o hakattara sanjūnana-do go-bu deshita.",
        "en": "Their face was a little red, and when I took their temperature it was 37.5°C.",
        "vi": "Mặt bác ấy hơi đỏ, khi đo nhiệt độ thì là 37,5 độ."
      },
      {
        "ja": "このあとも様子を見て、また報告します。",
        "furigana": "このあともようすをみて、またほうこくします。",
        "romaji": "Kono ato mo yōsu o mite, mata hōkoku shimasu.",
        "en": "I'll keep an eye on them and report again.",
        "vi": "Tôi sẽ tiếp tục theo dõi và báo cáo lại ạ."
      }
    ],
    "hints": [
      "さいしょに「〇〇さんの ことですが」と、だれの はなしか いいましょう。",
      "「いつもと ちがう こと」を いいましょう。かずも いいましょう。「はんぶん」「37ど5ぶ」。",
      "さいごに しじを くりかえしましょう。「30ぷんごに また はかるんですね。わかりました」。"
    ],
    "common_errors": [
      {
        "wrong": "田中さん、元気じゃないです。",
        "correct": "田中さんですが、昼ご飯を半分しか食べませんでした。熱は37度5分でした。",
        "why": "「元気じゃない」は感想。報告は見たこと・数字（事実）で言うと、リーダーが判断しやすい。"
      },
      {
        "wrong": "半分だけ食べませんでした。",
        "correct": "半分しか食べませんでした。",
        "why": "「〜しか」は後ろに否定（〜ない）が来る。「だけ」なら「半分だけ食べました」。"
      },
      {
        "wrong": "37.5度です。（さんじゅうななてんごど）",
        "correct": "37度5分です。（さんじゅうななどごぶ）",
        "why": "介護・医療の現場では体温を「〜度〜分」と言うことが多い。両方聞き取れるようにする。"
      }
    ],
    "safety_note": "利用者は架空の人物です。AIは病状の判断・服薬・医療行為についての助言をしない（「看護師・リーダーに相談する」「施設のルールに従う」までにとどめる）。実際の報告ルール・記録方法は各施設のマニュアルに従うよう、復習画面で一言添える。"
  },
  {
    "id": "factory_abnormal_report",
    "title_ja": "工場：機械の異常を班長に報告する",
    "title_furigana": "こうじょう：きかいのいじょうをはんちょうにほうこくする",
    "title": {
      "en": "Factory: Reporting a machine problem to the team leader",
      "vi": "Nhà máy: Báo cáo sự cố máy móc cho tổ trưởng"
    },
    "level": "N3",
    "goal_ja": "機械がいつもと違うとき、どこで何が起きたかと、安全のために止めたことを班長にすぐ報告できる。",
    "goal": {
      "en": "When a machine is not working normally, I can quickly tell the team leader where and what happened, and that I stopped it for safety.",
      "vi": "Khi máy có hiện tượng bất thường, tôi có thể nhanh chóng báo cho tổ trưởng ở đâu, chuyện gì đã xảy ra và việc tôi đã dừng máy để đảm bảo an toàn."
    },
    "goal_check": [
      "どの機械か（番号・場所）と、何が起きたか（音・におい・止まった等）を言った",
      "自分がしたこと（止めた／まだ動いている／さわっていない）を伝えた",
      "次にどうすればよいかを聞くか、班長の指示をくり返して確認した"
    ],
    "ai_role": "製造ラインの班長・高橋さん（40代男性）。安全を最優先する人。短くはっきりした普通体まじりの丁寧語（「どの機械？」「止めた？」「けがはない？」）。報告に場所や状態が足りなければ短く質問する。最後に「わかった。近づかないで、俺が行くまで待ってて」など明確な指示を出す。",
    "opening_line": "どうした？何かあった？",
    "key_phrases": [
      {
        "ja": "3番の機械から変な音がします。",
        "furigana": "さんばんのきかいからへんなおとがします。",
        "romaji": "San-ban no kikai kara hen na oto ga shimasu.",
        "en": "There's a strange noise coming from machine No. 3.",
        "vi": "Máy số 3 đang phát ra tiếng kêu lạ."
      },
      {
        "ja": "非常停止ボタンで機械を止めました。",
        "furigana": "ひじょうていしぼたんできかいをとめました。",
        "romaji": "Hijō teishi botan de kikai o tomemashita.",
        "en": "I stopped the machine with the emergency stop button.",
        "vi": "Tôi đã dừng máy bằng nút dừng khẩn cấp."
      },
      {
        "ja": "次はどうしたらいいですか。",
        "furigana": "つぎはどうしたらいいですか。",
        "romaji": "Tsugi wa dō shitara ii desu ka.",
        "en": "What should I do next?",
        "vi": "Tiếp theo tôi nên làm gì ạ?"
      }
    ],
    "hints": [
      "「どの きかい」か いいましょう。「3ばんの きかいです」。",
      "「なにが おきたか」いいましょう。「へんな おとが します」「とまりました」「へんな においが します」。",
      "「とめました」か「まだ うごいて います」か いいましょう。さいごに「つぎは どうしたら いいですか」。"
    ],
    "common_errors": [
      {
        "wrong": "機械、ちょっとおかしいです。",
        "correct": "3番の機械から変な音がします。",
        "why": "「おかしい」だけでは何が問題かわからない。番号・場所と、音・におい・動きなど具体的に言う。"
      },
      {
        "wrong": "機械が止めました。",
        "correct": "機械を止めました。／機械が止まりました。",
        "why": "自分がしたときは「〜を止めた（他動詞）」、自然に止まったときは「〜が止まった（自動詞）」。報告では意味が大きく変わる。"
      },
      {
        "wrong": "（わからないのに）はい、大丈夫です。",
        "correct": "すみません、もう一度お願いします。",
        "why": "安全に関わる指示は、聞き取れなかったら必ず聞き返す。わかったふりは事故の原因になる。"
      }
    ],
    "safety_note": "練習用の架空の工場です。AIは機械の修理方法や安全装置の操作を具体的に指導せず、安全の判断もしない。実際の異常時は会社の安全手順と班長の指示に従うこと、けが人がいるときはすぐに周りの人を呼び119番に連絡することを復習画面で添える。学習者が実際の事故・けがを話した場合は練習を止め、現場の責任者や119番への連絡を促す。"
  },
  {
    "id": "construction_morning_ky",
    "title_ja": "土木・建設：朝礼のKY活動で指示と危ないところを復唱する",
    "title_furigana": "どぼく・けんせつ：ちょうれいのけーわいかつどうでしじとあぶないところをふくしょうする",
    "title": {
      "en": "Construction: Repeating instructions and hazards at the morning KY (hazard prediction) meeting",
      "vi": "Xây dựng: Nhắc lại chỉ thị và điểm nguy hiểm trong buổi họp KY (dự đoán nguy hiểm) buổi sáng"
    },
    "level": "N3",
    "goal_ja": "朝礼で今日の作業の指示を復唱し、危ないところと安全対策を1つ言って、指差し呼称ができる。",
    "goal": {
      "en": "At the morning meeting, I can repeat today's work instructions, name one hazard and its safety measure, and do the point-and-call check.",
      "vi": "Trong buổi họp sáng, tôi có thể nhắc lại chỉ thị công việc hôm nay, nói một điểm nguy hiểm và biện pháp an toàn, và thực hiện chỉ tay hô to xác nhận."
    },
    "goal_check": [
      "今日の作業の場所と内容を復唱して確認した（「今日は〜で〜の作業ですね」）",
      "危ないところを1つ言い、その対策を「〜危険があるので、〜します」の形で言った",
      "指差し呼称（「〜よし！」）または「ご安全に！」で締めくくった"
    ],
    "ai_role": "建設現場の職長・木村さん（50代男性）。声が大きく、はっきり短く話す。普通体まじりの丁寧語（「今日は2階の足場で型枠ね」「危ないところはどこ？」「じゃあ対策は？」）。学習者が「はい」だけで復唱しなかったら「今日の作業、言ってみて」と促す。危険の答えがあいまいなら「何が起きると危ない？」と聞き直す。",
    "opening_line": "おはようございます！じゃあKYやるよ。今日は2階の足場で型枠の作業。危ないところはどこだと思う？",
    "key_phrases": [
      {
        "ja": "今日は2階の足場で、型枠の作業ですね。",
        "furigana": "きょうはにかいのあしばで、かたわくのさぎょうですね。",
        "romaji": "Kyō wa ni-kai no ashiba de, katawaku no sagyō desu ne.",
        "en": "So today we're doing formwork on the 2nd-floor scaffolding, right?",
        "vi": "Hôm nay chúng ta làm cốp pha trên giàn giáo tầng 2, đúng không ạ?"
      },
      {
        "ja": "足をすべらせて落ちる危険があるので、フルハーネスを必ず使います。",
        "furigana": "あしをすべらせておちるきけんがあるので、ふるはーねすをかならずつかいます。",
        "romaji": "Ashi o suberasete ochiru kiken ga aru node, furu hānesu o kanarazu tsukaimasu.",
        "en": "There's a danger of slipping and falling, so I'll always use my full-body harness.",
        "vi": "Vì có nguy cơ trượt chân và ngã, nên tôi nhất định sẽ sử dụng dây đai an toàn toàn thân."
      },
      {
        "ja": "足元よし！ご安全に！",
        "furigana": "あしもとよし！ごあんぜんに！",
        "romaji": "Ashimoto yoshi! Go-anzen ni!",
        "en": "Footing - OK! Work safely!",
        "vi": "Dưới chân - an toàn! Chúc làm việc an toàn!"
      }
    ],
    "hints": [
      "しじを きいたら「はい」だけでなく、くりかえしましょう。「きょうは 2かいの あしばですね」。",
      "「なにが おきると あぶないか」を いいましょう。「すべって おちる」「ものが おちてくる」。",
      "「〜きけんが あるので、〜します」と いいましょう。さいごに ゆびを さして「あしもと よし！」。"
    ],
    "common_errors": [
      {
        "wrong": "（指示に）はい。（復唱しない）",
        "correct": "はい、今日は2階の足場で型枠の作業ですね。",
        "why": "現場では聞きまちがいが事故につながる。「はい」だけでなく、場所と作業をくり返して確認する。"
      },
      {
        "wrong": "落ちるの危ないです。気をつけます。",
        "correct": "落ちる危険があるので、フルハーネスを必ず使います。",
        "why": "「危険がある」の形で言い、「気をつけます」ではなく何をするか（具体的な対策）を言う。"
      },
      {
        "wrong": "足元、いいです。",
        "correct": "足元よし！",
        "why": "指差し呼称は決まった言い方「〜よし！」を、指を差して大きな声で言う。"
      }
    ],
    "safety_note": "練習用の架空の現場です。AIは安全の判断をしない（「この作業は安全です」「この装備でよい」などと言わない）。正しい安全対策・保護具・作業手順は、必ず会社と現場の責任者の指示に従うこと。本当に危ないと感じたときは、作業を止めて、すぐに職長・現場の責任者に知らせること。けが人がいるときは周りの人を呼び119番に連絡すること。これらを復習画面でも必ず表示する。学習者が実際の事故・危険を話した場合は練習を止めて同じ案内をする。"
  }
];
