// JLPT 単語教材（見本：N5 20語）。会話や仕事で使えることを目標に、1語ごとに 意味・例文2つ（くらし・仕事）・練習を持つ。
// 練習は4つ：①単語→意味 ②例文を読んで理解 ③単語で文を作る（おてほんと比べて自分で〇つけ） ④（　）に入る語（一問一答の復習）
// 例文と問題は自作（JLPT公式の語彙リストは公開されていないため、一般的なN5の語から選んだ）。日本語教師の校閲待ち。
// ex[0]＝くらしの例文、ex[1]＝仕事の例文。blank＝ex[0] の中で（　）にする語、wrong＝そのときの まちがいの選択肢（形をそろえる）。check＝ex[1] についての質問（答えは choices[0]）
export const VOCAB = [
  { id: "n5-01", level: "N5", word: "仕事", reading: "しごと", pos: "noun",
    mean: { en: "work, job", vi: "công việc", id: "pekerjaan", tl: "trabaho" },
    ex: [{ ja: "あしたは 仕事が 休みです。", en: "Tomorrow is my day off from work.", vi: "Ngày mai tôi được nghỉ làm.", id: "Besok saya libur kerja.", tl: "Bukas ay day off ko sa trabaho." },
         { ja: "仕事は 8時に はじまります。", en: "Work starts at 8 o'clock.", vi: "Công việc bắt đầu lúc 8 giờ.", id: "Pekerjaan dimulai jam 8.", tl: "Nagsisimula ang trabaho nang alas-8." }],
    blank: "仕事", wrong: ["電話", "病院", "薬"], check: { q: "仕事は 何時から ですか。", choices: ["8時から", "9時から", "7時から", "10時から"] },
    make: { ja: "「仕事」を つかって、自分の 仕事を しょうかいする 文を 作りましょう。", model: "わたしの 仕事は りょうりを 作る ことです。" } },
  { id: "n5-02", level: "N5", word: "休む", reading: "やすむ", pos: "verb",
    mean: { en: "to rest; to take a day off", vi: "nghỉ, nghỉ ngơi", id: "beristirahat; libur", tl: "magpahinga; lumiban" },
    ex: [{ ja: "つかれたので、少し 休みます。", en: "I'm tired, so I'll rest a little.", vi: "Tôi mệt nên nghỉ một chút.", id: "Saya lelah, jadi saya istirahat sebentar.", tl: "Pagod ako, kaya magpapahinga muna ako nang kaunti." },
         { ja: "ねつが あるので、きょうは 仕事を 休みます。", en: "I have a fever, so I'll take the day off work today.", vi: "Tôi bị sốt nên hôm nay nghỉ làm.", id: "Saya demam, jadi hari ini saya tidak masuk kerja.", tl: "May lagnat ako, kaya liliban ako sa trabaho ngayon." }],
    blank: "休みます", wrong: ["待ちます", "洗います", "開けます"], check: { q: "どうして 仕事を 休みますか。", choices: ["ねつが あるから", "いそがしいから", "雨だから", "ねむいから"] },
    make: { ja: "「休みます」を つかって、会社の 人に 休みを つたえる 文を 作りましょう。", model: "すみません、あした 病院に 行くので、休みます。" } },
  { id: "n5-03", level: "N5", word: "待つ", reading: "まつ", pos: "verb",
    mean: { en: "to wait", vi: "chờ, đợi", id: "menunggu", tl: "maghintay" },
    ex: [{ ja: "駅の 前で 友だちを 待ちます。", en: "I wait for my friend in front of the station.", vi: "Tôi đợi bạn ở trước nhà ga.", id: "Saya menunggu teman di depan stasiun.", tl: "Hinihintay ko ang kaibigan ko sa harap ng istasyon." },
         { ja: "ここで 少し 待って ください。", en: "Please wait here a moment.", vi: "Xin hãy đợi ở đây một chút.", id: "Silakan tunggu di sini sebentar.", tl: "Pakihintay muna rito sandali." }],
    blank: "待ちます", wrong: ["休みます", "洗います", "閉めます"], check: { q: "何を して くださいと 言って いますか。", choices: ["ここで 待つ", "ここで 休む", "すぐ 来る", "電話を する"] },
    make: { ja: "「待って ください」を つかって、お客さんに 言う 文を 作りましょう。", model: "すみません、少し 待って ください。" } },
  { id: "n5-04", level: "N5", word: "来る", reading: "くる", pos: "verb",
    mean: { en: "to come", vi: "đến", id: "datang", tl: "dumating; pumunta rito" },
    ex: [{ ja: "日曜日に 友だちが うちに 来ます。", en: "My friend comes to my house on Sunday.", vi: "Chủ nhật bạn tôi đến nhà.", id: "Hari Minggu teman saya datang ke rumah.", tl: "Pupunta ang kaibigan ko sa bahay sa Linggo." },
         { ja: "あしたは 7時に 会社に 来て ください。", en: "Please come to the company at 7 o'clock tomorrow.", vi: "Ngày mai hãy đến công ty lúc 7 giờ.", id: "Besok silakan datang ke kantor jam 7.", tl: "Bukas, pumunta ka sa kompanya nang alas-7." }],
    blank: "来ます", wrong: ["待ちます", "休みます", "開けます"], check: { q: "あした 何時に 会社に 来ますか。", choices: ["7時", "8時", "6時", "9時"] },
    make: { ja: "「来ます」を つかって、あした 何時に 会社に 来るか 言いましょう。", model: "あしたは 8時に 会社に 来ます。" } },
  { id: "n5-05", level: "N5", word: "早い", reading: "はやい", pos: "adj",
    mean: { en: "early; fast", vi: "sớm; nhanh", id: "awal; cepat", tl: "maaga; mabilis" },
    ex: [{ ja: "あさ 5時に おきます。とても 早く おきます。", en: "I get up at 5 in the morning. I get up very early.", vi: "Tôi dậy lúc 5 giờ sáng. Tôi dậy rất sớm.", id: "Saya bangun jam 5 pagi. Saya bangun sangat awal.", tl: "Gumigising ako nang alas-5 ng umaga. Napakaaga kong gumising." },
         { ja: "きょうは 仕事が 早く おわりました。", en: "Work finished early today.", vi: "Hôm nay công việc xong sớm.", id: "Hari ini pekerjaan selesai lebih awal.", tl: "Maagang natapos ang trabaho ngayon." }],
    blank: "早く", wrong: ["遅く", "重く", "危なく"], check: { q: "きょうの 仕事は どう でしたか。", choices: ["早く おわった", "遅く おわった", "はじまらなかった", "休みだった"] },
    make: { ja: "「早く」を つかって、文を 作りましょう。", model: "あしたは 早く 来て ください。" } },
  { id: "n5-06", level: "N5", word: "遅い", reading: "おそい", pos: "adj",
    mean: { en: "late; slow", vi: "muộn; chậm", id: "terlambat; lambat", tl: "huli; mabagal" },
    ex: [{ ja: "バスが まだ 来ません。きょうは バスが 遅いです。", en: "The bus hasn't come yet. The bus is late today.", vi: "Xe buýt vẫn chưa đến. Hôm nay xe buýt đến muộn.", id: "Busnya belum datang. Hari ini busnya terlambat.", tl: "Wala pa ang bus. Huli ang bus ngayon." },
         { ja: "きのうは 夜 遅く まで 仕事を しました。", en: "Yesterday I worked until late at night.", vi: "Hôm qua tôi làm việc đến khuya.", id: "Kemarin saya bekerja sampai larut malam.", tl: "Kahapon, nagtrabaho ako hanggang gabi na." }],
    blank: "遅い", wrong: ["早い", "重い", "元気"], check: { q: "きのうは いつまで 仕事を しましたか。", choices: ["夜 遅く まで", "あさ 早く まで", "ひるまで", "5時まで"] },
    make: { ja: "「遅く」を つかって、きのうの ことを 言いましょう。", model: "きのうは 夜 遅く ねました。" } },
  { id: "n5-07", level: "N5", word: "危ない", reading: "あぶない", pos: "adj",
    mean: { en: "dangerous; Watch out!", vi: "nguy hiểm; Cẩn thận!", id: "berbahaya; Awas!", tl: "delikado; Ingat!" },
    ex: [{ ja: "危ない！ 車が 来ますよ。", en: "Watch out! A car is coming.", vi: "Nguy hiểm! Có xe đang đến đấy.", id: "Awas! Ada mobil datang.", tl: "Ingat! May paparating na kotse." },
         { ja: "そこは 危ないですから、入らないで ください。", en: "It's dangerous there, so please don't go in.", vi: "Chỗ đó nguy hiểm nên đừng vào.", id: "Di sana berbahaya, jadi jangan masuk.", tl: "Delikado diyan, kaya huwag kang pumasok." }],
    blank: "危ない", wrong: ["重い", "遅い", "早い"], check: { q: "どうして 入らないで くださいと 言いますか。", choices: ["危ないから", "きたないから", "遅いから", "重いから"] },
    make: { ja: "「危ない」を つかって、なかまに 注意する 文を 作りましょう。", model: "危ないですよ。そこに 立たないで ください。" } },
  { id: "n5-08", level: "N5", word: "元気", reading: "げんき", pos: "na",
    mean: { en: "healthy; well; energetic", vi: "khỏe; khỏe mạnh", id: "sehat; bersemangat", tl: "malusog; masigla" },
    ex: [{ ja: "「お元気ですか。」「はい、元気です。」", en: "\"How are you?\" \"I'm fine.\"", vi: "\"Bạn có khỏe không?\" \"Vâng, tôi khỏe.\"", id: "\"Apa kabar?\" \"Baik.\"", tl: "\"Kumusta ka?\" \"Mabuti naman.\"" },
         { ja: "きょうは 元気が ないですね。だいじょうぶですか。", en: "You don't look well today. Are you OK?", vi: "Hôm nay trông bạn không khỏe nhỉ. Có sao không?", id: "Hari ini kamu kelihatan lesu. Tidak apa-apa?", tl: "Parang matamlay ka ngayon. Okay ka lang ba?" }],
    blank: "元気", wrong: ["仕事", "電話", "時間"], check: { q: "この 人は きょう どう 見えますか。", choices: ["元気が ない", "とても 元気", "いそがしい", "おなかが すいた"] },
    make: { ja: "「元気」を つかって、家族の ことを 言いましょう。", model: "母は とても 元気です。" } },
  { id: "n5-09", level: "N5", word: "分かる", reading: "わかる", pos: "verb",
    mean: { en: "to understand", vi: "hiểu", id: "mengerti", tl: "maintindihan" },
    ex: [{ ja: "日本語が 少し 分かります。", en: "I understand a little Japanese.", vi: "Tôi hiểu một chút tiếng Nhật.", id: "Saya sedikit mengerti bahasa Jepang.", tl: "Medyo naiintindihan ko ang Japanese." },
         { ja: "すみません、よく 分かりません。もう一度 おねがいします。", en: "Sorry, I don't understand well. Once more, please.", vi: "Xin lỗi, tôi không hiểu rõ. Xin nói lại một lần nữa.", id: "Maaf, saya kurang mengerti. Tolong sekali lagi.", tl: "Pasensya na, hindi ko masyadong naintindihan. Pakiulit po." }],
    blank: "分かります", wrong: ["持ちます", "待ちます", "教えます"], check: { q: "この 人は 何を おねがいして いますか。", choices: ["もう一度 言って ほしい", "休みたい", "電話して ほしい", "待って ほしい"] },
    make: { ja: "「分かりません」を つかって、もう一度 聞く 文を 作りましょう。", model: "すみません、分かりません。ゆっくり 言って ください。" } },
  { id: "n5-10", level: "N5", word: "教える", reading: "おしえる", pos: "verb",
    mean: { en: "to teach; to tell, show", vi: "dạy; chỉ cho", id: "mengajar; memberi tahu", tl: "magturo; sabihin" },
    ex: [{ ja: "先生が 日本語を 教えます。", en: "The teacher teaches Japanese.", vi: "Giáo viên dạy tiếng Nhật.", id: "Guru mengajar bahasa Jepang.", tl: "Nagtuturo ng Japanese ang guro." },
         { ja: "この 仕事の やりかたを 教えて ください。", en: "Please show me how to do this job.", vi: "Xin hãy chỉ cho tôi cách làm việc này.", id: "Tolong ajari saya cara melakukan pekerjaan ini.", tl: "Pakituro po kung paano gawin ang trabahong ito." }],
    blank: "教えます", wrong: ["分かります", "洗います", "閉めます"], check: { q: "何を 教えて ほしいですか。", choices: ["仕事の やりかた", "駅の みち", "電話ばんごう", "日本語の かんじ"] },
    make: { ja: "「教えて ください」を つかって、場所を 聞く 文を 作りましょう。", model: "すみません、トイレの 場所を 教えて ください。" } },
  { id: "n5-11", level: "N5", word: "持つ", reading: "もつ", pos: "verb",
    mean: { en: "to hold, carry; to have", vi: "cầm, mang; có", id: "memegang, membawa; punya", tl: "humawak, magdala; mayroon" },
    ex: [{ ja: "雨ですね。かさを 持って いますか。", en: "It's raining. Do you have an umbrella?", vi: "Trời mưa nhỉ. Bạn có mang ô không?", id: "Hujan, ya. Kamu bawa payung?", tl: "Umuulan, ano? May dala ka bang payong?" },
         { ja: "この はこは 重いので、二人で 持ちましょう。", en: "This box is heavy, so let's carry it together (two people).", vi: "Cái hộp này nặng nên hai người cùng khiêng nhé.", id: "Kotak ini berat, jadi mari kita angkat berdua.", tl: "Mabigat ang kahong ito, kaya buhatin natin nang dalawahan." }],
    blank: "持って", wrong: ["待って", "洗って", "閉めて"], check: { q: "どうして 二人で 持ちますか。", choices: ["重いから", "危ないから", "遅いから", "少しだから"] },
    make: { ja: "「持って ください」を つかって、なかまに たのむ 文を 作りましょう。", model: "すみません、この にもつを 持って ください。" } },
  { id: "n5-12", level: "N5", word: "洗う", reading: "あらう", pos: "verb",
    mean: { en: "to wash", vi: "rửa, giặt", id: "mencuci", tl: "maghugas" },
    ex: [{ ja: "ごはんの 前に 手を 洗います。", en: "I wash my hands before meals.", vi: "Tôi rửa tay trước khi ăn cơm.", id: "Saya mencuci tangan sebelum makan.", tl: "Naghuhugas ako ng kamay bago kumain." },
         { ja: "つかった おさらは すぐ 洗って ください。", en: "Please wash the plates right after you use them.", vi: "Hãy rửa ngay đĩa đã dùng.", id: "Tolong segera cuci piring yang sudah dipakai.", tl: "Pakihugasan agad ang mga platong ginamit." }],
    blank: "洗います", wrong: ["持ちます", "待ちます", "閉めます"], check: { q: "おさらは いつ 洗いますか。", choices: ["つかった あと すぐ", "あした", "仕事の 前", "夜 遅く"] },
    make: { ja: "「洗います」を つかって、仕事の 前に する ことを 言いましょう。", model: "仕事の 前に、手を よく 洗います。" } },
  { id: "n5-13", level: "N5", word: "開ける", reading: "あける", pos: "verb",
    mean: { en: "to open (something)", vi: "mở (cái gì đó)", id: "membuka", tl: "buksan" },
    ex: [{ ja: "あついので、まどを 開けます。", en: "It's hot, so I open the window.", vi: "Trời nóng nên tôi mở cửa sổ.", id: "Panas, jadi saya membuka jendela.", tl: "Mainit, kaya bubuksan ko ang bintana." },
         { ja: "お店は 10時に ドアを 開けます。", en: "The shop opens its doors at 10 o'clock.", vi: "Cửa hàng mở cửa lúc 10 giờ.", id: "Toko membuka pintunya jam 10.", tl: "Binubuksan ng tindahan ang pinto nang alas-10." }],
    blank: "開けます", wrong: ["洗います", "持ちます", "待ちます"], check: { q: "お店は 何時に ドアを 開けますか。", choices: ["10時", "9時", "11時", "8時"] },
    make: { ja: "「開けても いいですか」を つかって、きょかを もらう 文を 作りましょう。", model: "あついですね。まどを 開けても いいですか。" } },
  { id: "n5-14", level: "N5", word: "閉める", reading: "しめる", pos: "verb",
    mean: { en: "to close, shut (something)", vi: "đóng (cái gì đó)", id: "menutup", tl: "isara" },
    ex: [{ ja: "さむいので、ドアを 閉めて ください。", en: "It's cold, so please close the door.", vi: "Trời lạnh nên hãy đóng cửa lại.", id: "Dingin, jadi tolong tutup pintunya.", tl: "Malamig, kaya pakisara ang pinto." },
         { ja: "帰る ときは、かぎを 閉めて ください。", en: "Please lock up when you go home.", vi: "Khi về hãy khóa cửa.", id: "Kalau pulang, tolong kunci pintunya.", tl: "Pag-uwi mo, pakisara ang kandado." }],
    blank: "閉めて", wrong: ["開けて", "待って", "洗って"], check: { q: "帰る ときに 何を しますか。", choices: ["かぎを 閉める", "まどを 開ける", "電話を する", "手を 洗う"] },
    make: { ja: "「閉めましょう」を つかって、文を 作りましょう。", model: "さむいですから、まどを 閉めましょう。" } },
  { id: "n5-15", level: "N5", word: "電話", reading: "でんわ", pos: "noun",
    mean: { en: "telephone; phone call", vi: "điện thoại; cuộc gọi", id: "telepon", tl: "telepono; tawag" },
    ex: [{ ja: "夜、国の 母に 電話を します。", en: "At night I call my mother back home.", vi: "Buổi tối tôi gọi điện cho mẹ ở quê.", id: "Malam hari saya menelepon ibu di kampung halaman.", tl: "Sa gabi, tinatawagan ko ang nanay ko sa amin." },
         { ja: "休む ときは、あさ 8時までに 会社に 電話して ください。", en: "When you take a day off, please call the company by 8 a.m.", vi: "Khi nghỉ, hãy gọi điện cho công ty trước 8 giờ sáng.", id: "Kalau tidak masuk, tolong telepon kantor sebelum jam 8 pagi.", tl: "Kapag liliban ka, tumawag sa kompanya bago mag-alas-8 ng umaga." }],
    blank: "電話", wrong: ["仕事", "時間", "病院"], check: { q: "休む ときは どう しますか。", choices: ["8時までに 会社に 電話する", "メールを 書く", "会社に 来る", "何も しない"] },
    make: { ja: "「電話」を つかって、あとで する ことを 言いましょう。", model: "あとで 電話を します。" } },
  { id: "n5-16", level: "N5", word: "時間", reading: "じかん", pos: "noun",
    mean: { en: "time; hour(s)", vi: "thời gian; giờ", id: "waktu; jam", tl: "oras" },
    ex: [{ ja: "いそがしいので、きょうは 時間が ありません。", en: "I'm busy, so I don't have time today.", vi: "Tôi bận nên hôm nay không có thời gian.", id: "Saya sibuk, jadi hari ini tidak ada waktu.", tl: "Abala ako, kaya wala akong oras ngayon." },
         { ja: "ひるやすみは 1時間です。", en: "The lunch break is one hour.", vi: "Nghỉ trưa là 1 tiếng.", id: "Istirahat siang satu jam.", tl: "Isang oras ang lunch break." }],
    blank: "時間", wrong: ["仕事", "薬", "病院"], check: { q: "ひるやすみは どのくらい ですか。", choices: ["1時間", "2時間", "30分", "10分"] },
    make: { ja: "「時間が ありますか」を つかって、人に 聞く 文を 作りましょう。", model: "すみません、いま 時間が ありますか。" } },
  { id: "n5-17", level: "N5", word: "病院", reading: "びょういん", pos: "noun",
    mean: { en: "hospital; clinic", vi: "bệnh viện", id: "rumah sakit", tl: "ospital" },
    ex: [{ ja: "かぜを ひいたので、病院へ 行きます。", en: "I caught a cold, so I'm going to the hospital.", vi: "Tôi bị cảm nên đi bệnh viện.", id: "Saya masuk angin, jadi saya pergi ke rumah sakit.", tl: "Sinipon ako, kaya pupunta ako sa ospital." },
         { ja: "けがを したら、すぐ 病院に 行って ください。", en: "If you get hurt, please go to the hospital right away.", vi: "Nếu bị thương, hãy đi bệnh viện ngay.", id: "Kalau terluka, segera pergi ke rumah sakit.", tl: "Kung masaktan ka, pumunta agad sa ospital." }],
    blank: "病院", wrong: ["仕事", "時間", "電話"], check: { q: "けがを したら どう しますか。", choices: ["すぐ 病院に 行く", "家で 待つ", "仕事を つづける", "だれにも 言わない"] },
    make: { ja: "「病院」を つかって、休む りゆうを 言いましょう。", model: "あした 病院に 行くので、仕事を 休みます。" } },
  { id: "n5-18", level: "N5", word: "薬", reading: "くすり", pos: "noun",
    mean: { en: "medicine", vi: "thuốc", id: "obat", tl: "gamot" },
    ex: [{ ja: "ごはんの あとで 薬を 飲みます。", en: "I take medicine after meals.", vi: "Tôi uống thuốc sau bữa ăn.", id: "Saya minum obat setelah makan.", tl: "Umiinom ako ng gamot pagkatapos kumain." },
         { ja: "あたまが いたいので、薬を ください。", en: "I have a headache, so please give me some medicine.", vi: "Tôi đau đầu, xin cho tôi thuốc.", id: "Kepala saya sakit, tolong beri saya obat.", tl: "Masakit ang ulo ko, pahingi po ng gamot." }],
    blank: "薬", wrong: ["時間", "電話", "病院"], check: { q: "この 人は どう しましたか。", choices: ["あたまが いたい", "おなかが すいた", "ねむい", "さむい"] },
    make: { ja: "「薬」を つかって、文を 作りましょう。", model: "この 薬は 1日 3回 飲みます。" } },
  { id: "n5-19", level: "N5", word: "重い", reading: "おもい", pos: "adj",
    mean: { en: "heavy", vi: "nặng", id: "berat", tl: "mabigat" },
    ex: [{ ja: "本が たくさん 入って いるので、この かばんは 重いです。", en: "There are a lot of books in it, so this bag is heavy.", vi: "Có nhiều sách bên trong nên cái cặp này nặng.", id: "Ada banyak buku di dalamnya, jadi tas ini berat.", tl: "Maraming libro sa loob, kaya mabigat ang bag na ito." },
         { ja: "重い ものを 持つ ときは、こしに 気を つけて ください。", en: "When you lift heavy things, be careful of your lower back.", vi: "Khi mang đồ nặng, hãy cẩn thận với lưng.", id: "Saat mengangkat barang berat, hati-hati dengan pinggang Anda.", tl: "Kapag bumubuhat ng mabigat, ingatan ang iyong balakang." }],
    blank: "重い", wrong: ["早い", "遅い", "危ない"], check: { q: "重い ものを 持つ とき、何に 気を つけますか。", choices: ["こし", "あたま", "手", "目"] },
    make: { ja: "「重い」を つかって、なかまに たのむ 文を 作りましょう。", model: "この はこは 重いですから、てつだって ください。" } },
  { id: "n5-20", level: "N5", word: "少し", reading: "すこし", pos: "adv",
    mean: { en: "a little, a few", vi: "một chút, một ít", id: "sedikit", tl: "kaunti" },
    ex: [{ ja: "さとうは たくさん 入れません。少し 入れます。", en: "I don't put in a lot of sugar. I put in a little.", vi: "Tôi không cho nhiều đường. Tôi cho một chút.", id: "Saya tidak memasukkan banyak gula. Saya masukkan sedikit.", tl: "Hindi ako naglalagay ng maraming asukal. Kaunti lang ang inilalagay ko." },
         { ja: "きょうは 少し つかれました。", en: "I'm a little tired today.", vi: "Hôm nay tôi hơi mệt.", id: "Hari ini saya agak lelah.", tl: "Medyo pagod ako ngayon." }],
    blank: "少し", wrong: ["重く", "遅く", "危なく"], check: { q: "きょう この 人は どう ですか。", choices: ["少し つかれた", "とても 元気", "病院に 行った", "仕事が ない"] },
    make: { ja: "「少し」を つかって、休みたい ことを つたえる 文を 作りましょう。", model: "すみません、少し 休んでも いいですか。" } },
];

// 練習の問題を作る。lang＝画面の言語（日本語の画面では、意味の選択肢は英語）
// mode: "mean"＝単語→意味 / "read"＝例文を読んで理解 / "make"＝文を作る / "blank"＝（　）に入る語
export const VOCAB_MODES = ["mean", "read", "make", "blank"];
const QHEAD = {
  read: "文を 読んで、しつもんに こたえて ください。",
  make: "文を 作って、声に 出して 言いましょう。言えたら「こたえを 見る」を おして ください。",
  blank: "（　）に 入る ことばは どれですか。",
};
const pick3 = (list, not) => list.filter(x => x !== not).sort(() => Math.random() - 0.5).slice(0, 3);
const trs = (o, lang) => lang === "ja" ? o.en : o[lang] || o.en;

export function vocabItem(v, mode, lang) {
  const base = { id: `${v.id}-${mode}`, exam: "JLPT単語", section: `JLPT ${v.level}`, scene: "単語" };
  if (mode === "mean") {
    const others = pick3([...new Set(VOCAB.map(w => trs(w.mean, lang)))], trs(v.mean, lang));
    return { ...base, term: v.word, reading: v.reading, question_ja: v.word, question_furigana: v.reading,
      choices: [trs(v.mean, lang), ...others], answer_index: 0, mode: "mc",
      explain_ja: v.ex[0].ja, explain_en: `${v.mean.en} — ${v.ex[0].en}`, explain_vi: `${v.mean.vi} — ${v.ex[0].vi}`,
      explain_id: `${v.mean.id} — ${v.ex[0].id}`, explain_tl: `${v.mean.tl} — ${v.ex[0].tl}`, say: v.reading };
  }
  if (mode === "read") {
    const e = v.ex[1];
    return { ...base, question_ja: `${QHEAD.read}\n${e.ja}\n${v.check.q}`, choices: v.check.choices, answer_index: 0, mode: "mc",
      explain_ja: e.ja, explain_en: e.en, explain_vi: e.vi, explain_id: e.id, explain_tl: e.tl, say: e.ja };
  }
  if (mode === "make") {
    return { ...base, question_ja: `${QHEAD.make}\n${v.make.ja}`, choices: null, answer_index: null, answer_text: v.make.model, mode: "flash",
      explain_ja: `ほかの 例：${v.ex[1].ja}`, explain_en: v.ex[1].en, explain_vi: v.ex[1].vi, explain_id: v.ex[1].id, explain_tl: v.ex[1].tl, say: v.make.model };
  }
  const e = v.ex[0];
  return { ...base, question_ja: `${QHEAD.blank}\n${e.ja.replace(v.blank, "（　）")}`, choices: [v.blank, ...v.wrong], answer_index: 0, mode: "mc",
    explain_ja: e.ja, explain_en: e.en, explain_vi: e.vi, explain_id: e.id, explain_tl: e.tl, say: e.ja };
}

// ふりがな表（make_ruby.mjs）に入れる日本語。画面に出る文と同じ形にする
export function vocabTexts() {
  const out = [];
  for (const v of VOCAB) {
    v.ex.forEach(e => out.push(e.ja));
    out.push(v.check.q, ...v.check.choices, v.make.ja, v.make.model, `ほかの 例：${v.ex[1].ja}`);
    out.push(...v.wrong, `${QHEAD.read}\n${v.ex[1].ja}\n${v.check.q}`, `${QHEAD.make}\n${v.make.ja}`, `${QHEAD.blank}\n${v.ex[0].ja.replace(v.blank, "（　）")}`, v.blank);
  }
  return out;
}
