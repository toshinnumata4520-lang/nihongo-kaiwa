// 場面ごとの「状況カード」：自分の立場・いま起きていること・伝えること（やること）。
// オーナーの試用の感想「会話が自由すぎて何を話せばいいか分からない」を受けて追加。
// AIの役（scenes.js の ai_role）と人名・数字をそろえること。
export const SITUATIONS = {
  work_late_call: {
    you: { ja: "あなたは 食品工場で 働いています。名前は「練習用の名前」を 使います。", en: "You work at a food factory. Use your practice name.", vi: "Bạn làm việc ở nhà máy thực phẩm. Dùng tên luyện tập của bạn." },
    now: { ja: "朝 7時50分。駅で 電車が 止まっています。仕事は 8時半から。9時10分ごろ 着きそうです。班長の 山田さんに 電話を かけました。", en: "7:50 a.m. Your train is stopped at the station. Work starts at 8:30. You will arrive around 9:10. You called your team leader, Mr. Yamada.", vi: "7 giờ 50 sáng. Tàu đang dừng ở ga. Giờ làm bắt đầu lúc 8 giờ 30. Bạn sẽ đến khoảng 9 giờ 10. Bạn đã gọi cho tổ trưởng Yamada." },
    todo: [
      { ja: "名前を 言う", en: "Say your name", vi: "Nói tên của bạn" },
      { ja: "遅れる 理由（電車が 止まっている）を 言う", en: "Say why you'll be late (train stopped)", vi: "Nói lý do đến muộn (tàu dừng)" },
      { ja: "着く 時間（9時10分ごろ）を 言う", en: "Say when you'll arrive (around 9:10)", vi: "Nói giờ sẽ đến (khoảng 9 giờ 10)" },
      { ja: "謝って、山田さんの 指示に 返事を する", en: "Apologize and answer his instruction", vi: "Xin lỗi và trả lời chỉ thị" },
    ],
  },
  life_konbini_pay: {
    you: { ja: "あなたは 仕事の 帰りに コンビニに 来ました。", en: "You stopped at a convenience store on your way home from work.", vi: "Bạn ghé cửa hàng tiện lợi trên đường đi làm về." },
    now: { ja: "お弁当を 1つ 買います。温めて ほしいです。袋は いりません。カードで 払いたいです。ポイントカードは 持って いません。", en: "You are buying one bento. You want it heated. You don't need a bag. You want to pay by card. You have no point card.", vi: "Bạn mua một hộp cơm. Bạn muốn hâm nóng. Không cần túi. Muốn trả bằng thẻ. Bạn không có thẻ tích điểm." },
    todo: [
      { ja: "温めて ほしいと 言う", en: "Ask to heat it", vi: "Nhờ hâm nóng" },
      { ja: "袋は いらないと 言う", en: "Say you don't need a bag", vi: "Nói không cần túi" },
      { ja: "カードで 払えるか 聞いて、払う", en: "Ask if you can pay by card, then pay", vi: "Hỏi có trả bằng thẻ được không và thanh toán" },
    ],
  },
  life_clinic_first_visit: {
    you: { ja: "あなたは 初めて 近くの 内科クリニックに 来ました。保険証を 持っています。", en: "You came to a nearby clinic for the first time. You have your insurance card.", vi: "Bạn lần đầu đến phòng khám nội khoa gần nhà. Bạn có thẻ bảo hiểm." },
    now: { ja: "きのうの 夜から 熱が あります（38度）。のども 痛いです。薬の アレルギーは ありません。受付の 人が 話しかけて きました。", en: "Since last night you've had a fever (38°C) and a sore throat. You have no drug allergies. The receptionist speaks to you.", vi: "Từ tối qua bạn bị sốt (38 độ) và đau họng. Bạn không dị ứng thuốc. Nhân viên lễ tân bắt chuyện với bạn." },
    todo: [
      { ja: "初めて 来たと 言って、保険証を 出す", en: "Say it's your first visit and show your card", vi: "Nói là lần đầu đến và đưa thẻ bảo hiểm" },
      { ja: "いつから・どこが・どうなのか 言う", en: "Say since when, where, and how you feel", vi: "Nói từ khi nào, chỗ nào, thế nào" },
      { ja: "質問（アレルギーなど）に 答えて、案内に 返事を する", en: "Answer questions (allergies) and reply to instructions", vi: "Trả lời câu hỏi (dị ứng) và đáp lại hướng dẫn" },
    ],
  },
  hotel_check_in: {
    you: { ja: "あなたは ホテルの フロントで 働いています。", en: "You work at a hotel front desk.", vi: "Bạn làm việc ở quầy lễ tân khách sạn." },
    now: { ja: "夕方 4時。予約の お客様（鈴木様）が 来ました。朝食は 7時〜9時半、2階の レストラン。チェックアウトは 11時です。", en: "4 p.m. A guest with a reservation (Mr. Suzuki) arrives. Breakfast: 7:00–9:30 at the 2nd-floor restaurant. Check-out: 11:00.", vi: "4 giờ chiều. Khách đã đặt phòng (ông Suzuki) đến. Ăn sáng 7:00–9:30 ở nhà hàng tầng 2. Trả phòng lúc 11 giờ." },
    todo: [
      { ja: "予約の 名前を 丁寧に 聞く", en: "Politely ask the reservation name", vi: "Hỏi lịch sự tên người đặt phòng" },
      { ja: "朝食の 時間と 場所を 案内する", en: "Explain breakfast time and place", vi: "Hướng dẫn giờ và nơi ăn sáng" },
      { ja: "お客様の 質問に 答える（分からなければ 確認すると 言う）", en: "Answer the guest's question (or say you'll check)", vi: "Trả lời câu hỏi của khách (nếu không biết thì nói sẽ kiểm tra)" },
    ],
  },
  food_take_order: {
    you: { ja: "あなたは 定食屋の ホールで 働いています。", en: "You work as a server at a set-meal restaurant.", vi: "Bạn làm phục vụ ở quán cơm phần." },
    now: { ja: "子ども連れの お客様が 呼んでいます。メニュー：唐揚げ定食、焼き魚定食、オレンジジュース など。アレルギーの ことは 自分では 分かりません（店長に 確認が 必要）。", en: "A customer with a child is calling you. Menu: fried chicken set, grilled fish set, orange juice, etc. You don't know allergy details yourself (you must ask the manager).", vi: "Khách có con nhỏ đang gọi bạn. Thực đơn: cơm gà rán, cơm cá nướng, nước cam… Bạn không tự biết về dị ứng (phải hỏi quản lý)." },
    todo: [
      { ja: "注文を 聞く", en: "Take the order", vi: "Nhận gọi món" },
      { ja: "注文を くり返して 確認する", en: "Repeat the order to confirm", vi: "Nhắc lại món để xác nhận" },
      { ja: "アレルギーの 質問には 自分で 答えず「確認して まいります」と 言う", en: "Don't answer the allergy question yourself; say you'll check", vi: "Không tự trả lời câu hỏi dị ứng; nói sẽ đi kiểm tra" },
    ],
  },
  care_report_resident: {
    you: { ja: "あなたは 介護施設で 働いています。", en: "You work at a care facility.", vi: "Bạn làm việc ở cơ sở điều dưỡng." },
    now: { ja: "昼ご飯の あと。利用者の 田中さんが 昼ご飯を 半分しか 食べませんでした。顔が 少し 赤いので 熱を 測ったら 37度5分でした。リーダーの 佐藤さんに 報告します。", en: "After lunch. Resident Mr. Tanaka ate only half of his lunch. His face was a little red; his temperature was 37.5°C. Report to the leader, Ms. Sato.", vi: "Sau bữa trưa. Bác Tanaka chỉ ăn một nửa. Mặt hơi đỏ, đo nhiệt độ là 37,5 độ. Hãy báo cáo cho trưởng nhóm Sato." },
    todo: [
      { ja: "だれの 報告か 最初に 言う（田中さんの ことですが）", en: "Say who it's about first", vi: "Nói trước là về ai" },
      { ja: "いつもと 違う ことを 数字で 言う（半分、37度5分）", en: "Say what's different with numbers", vi: "Nói điều khác thường bằng con số" },
      { ja: "佐藤さんの 指示を くり返して 確認する", en: "Repeat Ms. Sato's instruction to confirm", vi: "Nhắc lại chỉ thị của chị Sato để xác nhận" },
    ],
  },
  factory_abnormal_report: {
    you: { ja: "あなたは 部品工場の ラインで 働いています。", en: "You work on a parts factory line.", vi: "Bạn làm việc ở dây chuyền nhà máy linh kiện." },
    now: { ja: "3番の 機械から 変な 音が します。あなたは 非常停止ボタンで 機械を 止めました。けがは ありません。班長の 高橋さんが 来ました。", en: "Machine No. 3 is making a strange noise. You stopped it with the emergency stop button. Nobody is hurt. Team leader Mr. Takahashi comes over.", vi: "Máy số 3 phát ra tiếng lạ. Bạn đã dừng máy bằng nút khẩn cấp. Không ai bị thương. Tổ trưởng Takahashi đến." },
    todo: [
      { ja: "どの 機械で 何が 起きたか 言う", en: "Say which machine and what happened", vi: "Nói máy nào và chuyện gì xảy ra" },
      { ja: "自分が したこと（止めた）を 言う", en: "Say what you did (stopped it)", vi: "Nói việc bạn đã làm (dừng máy)" },
      { ja: "次に どうするか 聞いて、指示を くり返す", en: "Ask what to do next and repeat the instruction", vi: "Hỏi tiếp theo làm gì và nhắc lại chỉ thị" },
    ],
  },
  construction_morning_ky: {
    you: { ja: "あなたは 建設現場で 働いています。", en: "You work at a construction site.", vi: "Bạn làm việc ở công trường xây dựng." },
    now: { ja: "朝 8時の 朝礼。今日の 作業は 2階の 足場で 型枠。職長の 木村さんが KY（危険予知）を 始めます。落ちる 危険が あります。", en: "8 a.m. morning meeting. Today's work: formwork on the 2nd-floor scaffolding. Foreman Mr. Kimura starts the KY (hazard prediction). There is a danger of falling.", vi: "Họp sáng lúc 8 giờ. Việc hôm nay: làm cốp pha trên giàn giáo tầng 2. Đốc công Kimura bắt đầu KY (dự đoán nguy hiểm). Có nguy cơ ngã." },
    todo: [
      { ja: "今日の 作業の 場所と 内容を くり返す", en: "Repeat today's work place and task", vi: "Nhắc lại nơi và nội dung công việc hôm nay" },
      { ja: "危ない ところと 対策を 言う（落ちる 危険 → フルハーネス）", en: "Say the hazard and the measure (fall → full harness)", vi: "Nói nguy hiểm và biện pháp (ngã → dây đai toàn thân)" },
      { ja: "「足元 よし！」「ご安全に！」で しめる", en: "Finish with 'Ashimoto yoshi!' and 'Go-anzen ni!'", vi: "Kết thúc bằng 'Ashimoto yoshi!' và 'Go-anzen ni!'" },
    ],
  },
};
