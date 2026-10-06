const fs = require("fs");
const path = require("path");
const d = require("docx");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  TableOfContents, PageBreak, LevelFormat, convertInchesToTwip, ImageRun,
} = d;

const DIR = require("path").join(__dirname, "figures");
const INK = "1A1A1A", MUTED = "5A6862", ACCENT = "0B5E63";
const CODEBG = "F2F4F2", NOTEBG = "FFF6E0", DEFBG = "EAF1F0";

// ---------- helpers ----------
const h1 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 } });
const h2 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } });
const h3 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_3, spacing: { before: 220, after: 100 } });

function rich(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter((s) => s.length);
  return parts.map((s) => {
    if (s.startsWith("**")) return new TextRun({ text: s.slice(2, -2), bold: true, color: INK });
    if (s.startsWith("_")) return new TextRun({ text: s.slice(1, -1), italics: true, color: INK });
    return new TextRun({ text: s, color: INK });
  });
}
const p = (t) => new Paragraph({ children: rich(t), spacing: { after: 130, line: 310 }, alignment: AlignmentType.JUSTIFIED });
const bullet = (t) => new Paragraph({ children: rich(t), numbering: { reference: "bullets", level: 0 }, spacing: { after: 70, line: 300 } });
const num = (t) => new Paragraph({ children: rich(t), numbering: { reference: "steps", level: 0 }, spacing: { after: 70, line: 300 } });

function code(lines) {
  return lines.map((ln, i) => new Paragraph({
    children: [new TextRun({ text: ln === "" ? " " : ln, font: "Consolas", size: 17, color: "173A3D" })],
    shading: { type: ShadingType.CLEAR, fill: CODEBG },
    spacing: { before: i === 0 ? 110 : 0, after: i === lines.length - 1 ? 150 : 0, line: 240 },
    indent: { left: 200, right: 200 },
  }));
}

function box(title, text, fill, bar) {
  return [new Paragraph({
    children: [new TextRun({ text: title + " ", bold: true, color: bar }), ...rich(text)],
    shading: { type: ShadingType.CLEAR, fill },
    spacing: { before: 130, after: 170, line: 300 },
    indent: { left: 200, right: 200 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: bar, space: 8 } },
    alignment: AlignmentType.JUSTIFIED,
  })];
}
const note = (title, text) => box(title, text, NOTEBG, "D99A00");
const def = (term, text) => box(term, text, DEFBG, ACCENT);

const TOTAL = 9360;
function table(headers, rows, weights) {
  const w = weights || headers.map(() => 1);
  const sum = w.reduce((a, b) => a + b, 0);
  const widths = w.map((x) => Math.round((TOTAL * x) / sum));
  widths[widths.length - 1] = TOTAL - widths.slice(0, -1).reduce((a, b) => a + b, 0);
  const cell = (text, i, isHead) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: isHead ? { type: ShadingType.CLEAR, fill: "E4EDEC" } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: [new Paragraph({
      children: [new TextRun({ text: String(text), bold: !!isHead, size: 19, color: INK,
        font: /^[-+0-9.,()= µ<>/]+$/.test(String(text)) ? "Consolas" : undefined })],
      spacing: { after: 0, line: 255 },
    })],
  });
  return new Table({
    columnWidths: widths,
    width: { size: TOTAL, type: WidthType.DXA },
    rows: [new TableRow({ tableHeader: true, children: headers.map((t, i) => cell(t, i, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((t, i) => cell(t, i, false)) }))],
  });
}

// --- images ---
let figNo = 0;
function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function figure(file, caption, maxInches = 6.3) {
  const buf = fs.readFileSync(path.join(DIR, file));
  const { w, h } = pngSize(buf);
  const wpt = Math.min(maxInches * 72, (w / 160) * 72);   // hình xuất ở 160 dpi
  const hpt = (h / w) * wpt;
  figNo++;
  return [
    new Paragraph({
      children: [new ImageRun({ data: buf, type: "png", transformation: { width: wpt, height: hpt } })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Hình ${figNo} — ${caption}`, italics: true, size: 18, color: MUTED })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  ];
}
const gap = () => new Paragraph({ text: "", spacing: { after: 110 } });
const cap = (t) => new Paragraph({
  children: [new TextRun({ text: t, italics: true, size: 18, color: MUTED })],
  alignment: AlignmentType.CENTER, spacing: { after: 180 },
});
const brk = () => new Paragraph({ children: [new PageBreak()] });

const body = [];
const P = (...xs) => body.push(...xs.flat());

// ===================== BÌA =====================
P(
  new Paragraph({ text: "", spacing: { after: 1400 } }),
  new Paragraph({ children: [new TextRun({ text: "Firmware điều khiển máy in 3D CoreXY", bold: true, size: 54, color: ACCENT })], alignment: AlignmentType.CENTER, spacing: { after: 180 } }),
  new Paragraph({ children: [new TextRun({ text: "Tài liệu kỹ thuật và đào tạo", size: 30, color: INK })], alignment: AlignmentType.CENTER, spacing: { after: 100 } }),
  new Paragraph({ children: [new TextRun({ text: "Từ nguyên lý động cơ bước tới bộ điều khiển chuyển động hoàn chỉnh", size: 24, color: MUTED })], alignment: AlignmentType.CENTER, spacing: { after: 700 } }),
  new Paragraph({ children: [new TextRun({ text: "Vi điều khiển STM32H743IIT6 · Driver TMC2209 · Cơ cấu CoreXY", size: 23, color: INK })], alignment: AlignmentType.CENTER, spacing: { after: 90 } }),
  new Paragraph({ children: [new TextRun({ text: "Toàn bộ firmware tự viết, mọi số liệu trong tài liệu đều đo trên máy thật", size: 21, color: MUTED })], alignment: AlignmentType.CENTER, spacing: { after: 90 } }),
  new Paragraph({ children: [new TextRun({ text: "github.com/datye2/Core_XY_printer · tháng 10 năm 2026", size: 21, color: MUTED })], alignment: AlignmentType.CENTER }),
  brk()
);

P(new Paragraph({ text: "Mục lục", heading: HeadingLevel.HEADING_1, spacing: { after: 160 } }),
  new TableOfContents("Mục lục", { hyperlink: true, headingStyleRange: "1-3" }), brk());

// ===================== 0 =====================
P(h1("0. Giới thiệu"));
P(h2("0.1 Tài liệu này viết cho ai"));
P(p("Tài liệu dành cho người biết lập trình C ở mức cơ bản và đã từng điều khiển một chân GPIO trên vi điều khiển, nhưng **chưa từng học lý thuyết điều khiển chuyển động**. Mọi khái niệm chuyên ngành sẽ được định nghĩa ngay tại chỗ nó xuất hiện lần đầu, kèm con số cụ thể của chính cỗ máy này, không để người đọc phải tra cứu nơi khác rồi quay lại."));
P(p("Nội dung là toàn bộ quá trình xây dựng firmware cho một máy in 3D kiểu CoreXY, viết từ con số không, không dùng Marlin, Klipper hay RepRapFirmware. Mỗi chương tương ứng một bước phát triển đã thực hiện, theo đúng thứ tự thời gian, và mỗi bước đều kết thúc bằng phép đo trên phần cứng thật."));

P(h2("0.2 Cách đọc"));
P(bullet("**Chương 1 tới 3** là nền tảng: động cơ bước, timer, động học CoreXY, kiến trúc phần mềm. Nên đọc tuần tự, các chương sau đều dựa vào đây."));
P(bullet("**Chương 4 tới 10** là các bước đã làm. Mỗi chương có cấu trúc giống nhau: vấn đề cần giải, nguyên lý, cách cài đặt, phép thử và số liệu."));
P(bullet("**Chương 11 tới 13** là phương pháp làm việc, tổng hợp lỗi đã gặp, và phụ lục tra cứu."));
P(...note("Nguyên tắc xuyên suốt dự án:", "không viết một dòng code nào cho bước sau khi bước hiện tại chưa chạy được trên phần cứng thật và chưa có số đo chứng minh. Mọi con số trong tài liệu đều là số đo, không phải số ước lượng."));

// ===================== 1 =====================
P(brk(), h1("1. Nền tảng: động cơ bước và cách ra lệnh cho nó"));

P(h2("1.1 Động cơ bước khác động cơ thường ở chỗ nào"));
P(p("Động cơ một chiều thông thường cứ cấp điện là quay liên tục, muốn biết nó quay được bao nhiêu phải gắn thêm cảm biến đo góc. Động cơ bước thì ngược lại: nó quay theo **từng nấc rời rạc**, và mỗi nấc có góc cố định do cấu tạo cơ khí quyết định."));
P(p("Loại NEMA17 dùng phổ biến trong máy in 3D có **200 nấc cho một vòng**, tức mỗi nấc 1.8 độ. Bên trong có hai cuộn dây đặt vuông góc nhau. Nam châm vĩnh cửu của rotor luôn bị kéo về hướng của từ trường tổng do hai cuộn tạo ra. Thay đổi dòng trong hai cuộn theo đúng trình tự thì từ trường quay, và rotor quay theo từng nấc."));
P(...def("Hệ hở (open loop):", "hệ điều khiển không có phản hồi về kết quả thực tế. Máy in 3D dùng động cơ bước chính là hệ hở: firmware đếm số xung đã phát ra và **tin rằng** động cơ đã quay đúng ngần ấy nấc, chứ không hề đo lại."));
P(p("Ưu điểm của hệ hở là đơn giản và rẻ. Nhược điểm nằm ngay cạnh: nếu tải quá nặng hoặc lệnh quay quá nhanh, rotor không theo kịp từ trường và **trượt bước**. Không có cảm biến nên không ai phát hiện ra. Firmware vẫn tưởng mọi thứ bình thường, còn chi tiết in ra thì lệch."));
P(...note("Vì sao điều này quan trọng:", "phần lớn công sức trong tài liệu này, đặc biệt chương 7 về gia tốc, tồn tại chỉ để bảo đảm một điều: **không bao giờ ra lệnh vượt quá khả năng vật lý của động cơ**. Vì nếu vượt, sẽ không có lỗi nào được báo cả."));

P(h2("1.2 Hai sợi dây STEP và DIR"));
P(p("Vi điều khiển không đủ sức cấp dòng cho động cơ, nên có một mạch trung gian gọi là **driver**, ở máy này là TMC2209. Driver lo toàn bộ phần dòng điện và thứ tự cấp điện cho hai cuộn dây. Vi điều khiển chỉ cần nói chuyện với driver bằng hai dây:"));
P(bullet("**DIR** (direction): một mức logic. 0 là quay một chiều, 1 là quay chiều ngược lại."));
P(bullet("**STEP** (còn gọi là PUL, pulse): mỗi lần chân này đi từ 0 lên 1, driver dịch động cơ đúng **một vi bước**. Mức 1 chỉ cần giữ khoảng 100 nano giây là driver nhận ra, dự án này dùng 2 micro giây cho chắc chắn."));
P(...figure("fig_step_dir.png", "Mỗi cạnh lên của tín hiệu STEP làm động cơ nhích một vi bước. Khoảng cách giữa hai xung quyết định tốc độ: xung mau là nhanh, xung thưa là chậm."));
P(p("Toàn bộ nhiệm vụ của firmware, nói gọn lại, chỉ là **phát xung STEP vào đúng thời điểm**. Mọi chương sau đều xoay quanh câu hỏi: xung tiếp theo nên phát vào lúc nào."));
P(p("Quan hệ giữa chu kỳ xung và tốc độ là nghịch đảo. Với máy này, 80 vi bước ứng với 1 mm:"));
P(table(["Chu kỳ giữa hai xung", "Tần số xung", "Tốc độ đầu in"],
  [["2000 µs", "500 Hz", "6.3 mm/s"], ["625 µs", "1600 Hz", "20 mm/s"], ["83 µs", "12000 Hz", "150 mm/s"], ["25 µs", "40000 Hz", "500 mm/s, giới hạn của máy"]],
  [1.4, 1, 1.6]));
P(gap());

P(h2("1.3 Vi bước: chia nhỏ mỗi nấc"));
P(p("Nếu chỉ dùng 200 nấc nguyên cho một vòng, mỗi nấc là một cú giật, máy rung và ồn. Driver hiện đại khắc phục bằng cách **không chuyển dòng đột ngột giữa hai cuộn**, mà thay đổi dần theo dạng hình sin. Rotor khi đó dừng ở các vị trí trung gian giữa hai nấc cơ khí."));
P(...figure("fig_microstep.png", "Vi bước 1/16: dòng trong hai cuộn dây thay đổi theo hình sin lệch pha nhau 90 độ. Mỗi chấm tròn là một xung STEP, mười sáu chấm mới hết một nấc cơ khí."));
P(p("Máy này dùng **1/16 vi bước**, tức một vòng động cơ cần 200 × 16 = 3200 xung."));
P(...def("Nội suy (interpolation):", "TMC2209 có chức năng tự chia nhỏ thêm: nhận xung ở mức 1/16 nhưng bên trong tự sinh ra các bước trung gian cho tới mức 1/256. Vi điều khiển chỉ phải phát 3200 xung mỗi vòng, nhưng dòng điện mượt như thể 51200 xung."));
P(...note("Hiểu đúng về vi bước:", "vi bước làm chuyển động **mượt hơn**, không làm máy **chính xác hơn**. Mômen giữ của một vi bước tỉ lệ với sin của góc lệch, nên ở mức 1/16 thì mỗi vi bước chỉ còn khoảng 10% mômen. Chia nhỏ hơn nữa thì ma sát trong máy nuốt hết phần lực đó, rotor không thực sự dừng đúng vị trí được chỉ định. Đây là lý do dự án giữ 1/16 chứ không tăng lên 1/32 hay 1/64."));

P(h2("1.4 Hằng số quy đổi: 80 bước cho mỗi milimét"));
P(p("Người dùng ra lệnh bằng milimét, động cơ hiểu bằng số xung. Cầu nối là cơ cấu truyền động. Máy này dùng dây đai GT2 bước răng 2 mm, puly 20 răng:"));
P(...code([
  "chu vi puly    = 20 răng × 2 mm = 40 mm cho mỗi vòng quay",
  "số xung/vòng   = 200 nấc × 16   = 3200 xung",
  "",
  "steps_per_mm   = 3200 / 40      = 80 xung cho mỗi milimét",
  "độ phân giải   = 1 / 80         = 0.0125 mm = 12.5 micromét",
]));
P(p("Con số **80** xuất hiện xuyên suốt tài liệu. Nó cũng cho biết giới hạn vật lý của máy: không có cách nào ra lệnh di chuyển nhỏ hơn 12.5 micromét."));

P(h2("1.5 Timer và ngắt: cách giữ nhịp chính xác"));
P(p("Cách phát xung ngây thơ nhất là dùng vòng lặp kèm hàm trễ. Cách này hỏng vì hai lý do: CPU bị chiếm hoàn toàn nên không làm được việc gì khác, và thời gian trễ không chính xác vì phụ thuộc vào việc trình biên dịch tối ưu ra sao."));
P(...def("Timer:", "một bộ đếm chạy bằng phần cứng, hoàn toàn độc lập với CPU. Nó đếm lên theo một xung clock cố định. Khi đếm tới một giá trị định trước, nó phát tín hiệu báo. Vì chạy bằng phần cứng nên thời gian chính xác tuyệt đối, không bị ảnh hưởng bởi CPU đang bận gì."));
P(...def("Ngắt (interrupt):", "tín hiệu yêu cầu CPU tạm dừng việc đang làm, nhảy sang chạy một hàm riêng, xong thì quay lại đúng chỗ cũ như chưa có gì xảy ra. Hàm đó gọi là **trình phục vụ ngắt**, viết tắt **ISR** (Interrupt Service Routine)."));
P(p("Nhờ hai cơ chế này, phát xung trở thành: nạp vào timer khoảng thời gian cần chờ, timer tự đếm, tới lúc thì gọi ISR, ISR phát một xung rồi nạp khoảng thời gian cho xung kế tiếp. Giữa hai lần ngắt, CPU rảnh để làm việc khác."));
P(h3("Cấu hình cụ thể của dự án"));
P(table(["Thông số", "Giá trị", "Lý do chọn"],
  [["Timer", "TIM2", "bộ đếm 32 bit, đặt được chu kỳ rất dài khi chạy chậm mà không tràn"],
   ["Clock vào timer", "240 MHz", "clock của nhánh bus APB1 trong chip"],
   ["Prescaler", "239", "240 MHz chia cho 240 bằng 1 MHz, nên **một nhịp đếm đúng 1 micro giây**"],
   ["ARR", "thay đổi theo tốc độ", "số nhịp giữa hai lần ngắt, cũng chính là chu kỳ xung tính bằng micro giây"]],
  [1.3, 1.2, 3.5]));
P(gap());
P(...def("ARR (Auto Reload Register):", "thanh ghi chứa giá trị mà timer đếm tới trước khi phát ngắt rồi quay về 0. Vì ở đây một nhịp là 1 micro giây, ARR đọc thẳng ra chu kỳ xung. ARR = 83 nghĩa là cứ 83 micro giây phát một xung."));
P(...def("Preload:", "cơ chế của phần cứng: khi ghi giá trị mới vào ARR, giá trị đó **không có hiệu lực ngay** mà được giữ trong một thanh ghi đệm, chỉ nạp vào thật khi chu kỳ hiện tại kết thúc. Nghe như phiền, nhưng lại đúng ý khi tăng giảm tốc: chu kỳ đang chạy không bị can thiệp giữa chừng, còn giá trị mới tự động áp dụng cho chu kỳ kế tiếp. Chỉ khi bắt đầu một lệnh chạy mới mới cần ép nạp ngay, bằng cách tạo một sự kiện cập nhật."));

P(h2("1.6 Luật bất thành văn khi viết ISR"));
P(p("Ở tốc độ cao, ISR phát xung chạy hơn 30 000 lần mỗi giây. Mỗi lần chạy chỉ được phép chiếm vài micro giây, nếu không toàn hệ thống sụp đổ. Các quy tắc áp dụng trong dự án:"));
P(bullet("Không gọi hàm trễ, không chờ vòng lặp, không gọi hàm giao tiếp như UART hay USB."));
P(bullet("Không dùng số thực nếu tránh được. Lý do không chỉ là tốc độ: mỗi lần vào ngắt mà có dùng FPU, phần cứng phải cất thêm một tập thanh ghi, làm thời gian vào ngắt dài thêm và dao động."));
P(bullet("Mọi phép tính nặng, mọi căn bậc hai, đẩy hết lên vòng lặp chính và tính sẵn một lần cho mỗi lệnh chạy."));
P(bullet("Biến dùng chung giữa ISR và vòng lặp chính phải khai báo **volatile**, nếu không trình biên dịch có thể giữ giá trị trong thanh ghi và không bao giờ đọc lại từ bộ nhớ."));

// ===================== 2 =====================
P(brk(), h1("2. Động học CoreXY"));
P(h2("2.1 Vấn đề: không có motor X, cũng không có motor Y"));
P(p("Máy in kiểu Cartesian thông thường có một motor lo trục X, một motor lo trục Y. Muốn đi theo X thì quay motor X. Đơn giản, nhưng có một nhược điểm: motor X phải **di chuyển cùng** với trục Y, nên khối lượng chuyển động lớn, hạn chế gia tốc."));
P(p("CoreXY giải quyết bằng cách gắn **cả hai motor cố định trên khung**. Không motor nào phải di chuyển. Cái giá phải trả là cả hai motor cùng tham gia vào mọi chuyển động, thông qua hai vòng dây đai bắt chéo nhau."));
P(...figure("fig_corexy.png", "Sơ đồ cơ cấu CoreXY nhìn từ trên xuống. Hai đai chạy qua các puly ở bốn góc và cùng nối vào đầu in.", 4.6));

P(h2("2.2 Dẫn ra công thức từ nguyên lý dây đai"));
P(p("Chỉ cần một nguyên lý duy nhất: **dây đai không co giãn**."));
P(p("Mỗi vòng đai có hai đầu gắn vào đầu in, ở giữa quấn qua puly của một motor. Nếu motor đứng yên, dây không thể trượt qua puly, nên **chiều dài đoạn dây từ motor tới đầu in bị khoá cứng**. Motor quay bao nhiêu milimét thì đoạn dây đó dài ra hoặc ngắn đi đúng bấy nhiêu."));
P(p("Bây giờ đi theo đoạn dây của motor A, từ puly tới đầu in. Nó gồm hai phần: một phần chạy dọc cạnh bên, chiều dài phụ thuộc vị trí của thanh ngang tức toạ độ Y; một phần chạy dọc thanh ngang tới đầu in, chiều dài phụ thuộc toạ độ X. Vậy:"));
P(...code([
  "L_A = X + Y + hằng số",
  "L_B = Y − X + hằng số        (đai B đối xứng gương, nên dấu của X ngược lại)",
]));
P(p("Đổi quy ước chiều dương của motor B, tức đảo dây DIR, thì được dạng quen thuộc. Đây là **động học ngược**, dùng khi biết đầu in cần đi đâu và muốn biết motor phải quay bao nhiêu:"));
P(...code([
  "ΔA = ΔX + ΔY",
  "ΔB = ΔX − ΔY",
  "",
  "Cộng và trừ hai vế sẽ ra động học thuận, dùng để biết đầu in đang ở đâu:",
  "ΔX = (ΔA + ΔB) / 2",
  "ΔY = (ΔA − ΔB) / 2",
]));
P(...note("Về dấu cộng trừ:", "dấu có thể khác tuỳ cách đi dây và chiều lắp motor. Nếu máy chạy ngược, chỉ cần đảo chân DIR hoặc hoán đổi vai trò A và B. Bản chất không đổi: **một motor ứng với tổng X + Y, motor kia ứng với hiệu X − Y**."));

P(h2("2.3 Bốn chuyển động cơ bản"));
P(...figure("fig_four_moves.png", "Áp công thức cho bốn hướng tiêu biểu. Ở hai hướng chéo, một trong hai motor đứng yên hoàn toàn."));
P(p("Kiểm chứng bằng tay cũng ra kết quả này. Đẩy đầu in sang phải mà giữ thanh ngang đứng yên: đoạn đai A trên thanh ngang dài ra, đoạn đai B ngắn lại, nên hai puly quay cùng chiều. Đẩy thanh ngang tiến lên mà đầu in đứng yên trên thanh: cả hai đoạn dọc đều ngắn đi, nhưng vì hai motor đối xứng gương nên hai puly quay ngược chiều nhau."));

P(h2("2.4 Một đường thẳng trong XY vẫn là đường thẳng trong AB"));
P(p("Phép biến đổi giữa hai hệ toạ độ là **tuyến tính**: mỗi toạ độ mới chỉ là tổng hoặc hiệu của hai toạ độ cũ, không có phép nhân hay luỹ thừa nào. Đây là tính chất cực kỳ quan trọng về mặt phần mềm."));
P(...figure("fig_xy_ab.png", "Một hình vuông trong mặt phẳng XY, khi nhìn bằng toạ độ hai motor, trở thành hình vuông xoay 45 độ và phóng to. Các cạnh vẫn là đoạn thẳng."));
P(p("Hệ quả thực tế: toàn bộ phần lập kế hoạch chuyển động, tính gia tốc, nội suy đoạn thẳng đều có thể làm trong hệ XY như máy thông thường. Chỉ cần đổi sang A và B ở **bước cuối cùng**, ngay trước khi phát xung. Nếu phép biến đổi không tuyến tính, như ở máy Delta, mọi thứ sẽ phức tạp hơn rất nhiều."));

P(h2("2.5 Hệ số căn hai và hệ quả"));
P(p("Khi đầu in đi chéo 45 độ, chỉ một motor làm việc nhưng motor đó phải quay nhanh hơn. Cụ thể, đi chéo một đoạn dài L thì ΔX và ΔY đều bằng L chia căn 2, nên ΔA bằng tổng của chúng, tức **L nhân căn 2**."));
P(table(["Hướng đi", "Quãng đường đầu in", "Số bước của motor bận nhất", "Tỉ lệ"],
  [["Thẳng theo X hoặc Y", "100 mm", "8000 bước", "80 bước/mm"],
   ["Chéo 45 độ", "100 mm", "11314 bước", "113 bước/mm"]],
  [1.6, 1.2, 1.5, 1]));
P(gap());
P(...note("Hệ quả cần nhớ khi lập trình:", "mọi giới hạn về tốc độ và gia tốc phải đặt cho **từng motor**, không đặt cho đầu in. Nếu chỉ giới hạn tốc độ đầu in ở 300 mm/s, thì khi đi chéo motor sẽ phải chạy ở mức tương đương 424 mm/s và có thể vượt khả năng."));
P(p("Một cách hình dung khác: CoreXY chính là một máy Cartesian **bị xoay 45 độ**. Motor A điều khiển trục chéo theo hướng này, motor B điều khiển trục chéo theo hướng kia."));

// ===================== 3 =====================
P(brk(), h1("3. Kiến trúc phần mềm"));
P(p("Trước khi viết dòng code nào cần quyết định chia phần mềm thành những lớp nào. Chia đúng thì mỗi lớp chỉ phải biết một việc, và sửa lớp này không làm hỏng lớp kia."));
P(...figure("fig_arch.png", "Năm lớp của firmware. Ranh giới quan trọng nhất là đường nét đứt: phía trên dùng milimét và số thực, phía dưới dùng nhịp timer và số nguyên.", 5.2));
P(table(["Lớp", "Chạy ở đâu", "Đơn vị", "Kiểu số", "Được phép chậm"],
  [["gcode.c", "vòng lặp chính", "mm", "số thực", "được"],
   ["motion_control.c", "vòng lặp chính", "mm", "số thực", "được"],
   ["stepper.c, phần planner", "vòng lặp chính", "mm, mm/s", "số thực", "được"],
   ["stepper.c, phần ISR", "ngắt timer", "nhịp, µs", "**số nguyên**", "**tuyệt đối không**"]],
  [2, 1.3, 1.1, 1.1, 1.4]));
P(gap());
P(p("Chỗ đổi đơn vị nằm gọn trong đúng một hàm, gọi là `load_block`, chạy một lần mỗi khi bắt đầu một đoạn chuyển động mới. Nhờ vậy, khi đọc code ISR không bao giờ phải tự hỏi biến này đang tính bằng đơn vị gì."));

// ===================== 4 =====================
P(brk(), h1("4. Bước 0: cấu hình driver TMC2209 qua UART"));
P(h2("4.1 Vì sao bắt buộc phải có bước này"));
P(p("TMC2209 có hai chân MS1 và MS2 để chọn mức vi bước bằng cách nối lên nguồn hoặc xuống mát. Nhưng trong thiết kế này, hai chân đó đã bị dùng cho việc khác: **đặt địa chỉ** cho driver, vì hai driver dùng chung một đường dây giao tiếp."));
P(p("Hậu quả: nếu không làm gì thêm, driver A chạy ở mức 1/8 còn driver B chạy 1/32, lệch nhau bốn lần. Với CoreXY thì hai motor phải phối hợp chặt chẽ, lệch như vậy nghĩa là vẽ hình vuông sẽ ra hình méo xiên. Bắt buộc phải cài vi bước bằng phần mềm, qua UART."));

P(h2("4.2 UART và đường truyền một dây"));
P(...def("UART:", "giao thức truyền dữ liệu nối tiếp đơn giản nhất. Mỗi byte được gửi thành một chuỗi mức điện áp: một bit khởi đầu, tám bit dữ liệu, một bit kết thúc. Hai bên phải thống nhất trước **tốc độ truyền**, gọi là baud, ví dụ 115200 baud nghĩa là 115200 bit mỗi giây. Không có dây clock, hai bên tự đếm thời gian, nên sai lệch tốc độ quá 2% là hỏng."));
P(p("TMC2209 dùng một biến thể đặc biệt: chân PDN_UART vừa nhận vừa gửi trên **cùng một sợi dây**. Vi điều khiển nối chân phát qua một điện trở 1k rồi chung với chân thu vào sợi đó:"));
P(...code([
  "PB10 (TX) ──[1k]──┬── PDN_UART driver A, địa chỉ 0",
  "                  ├── PDN_UART driver B, địa chỉ 1",
  "PB11 (RX) ────────┘",
]));
P(...note("Hệ quả của việc dùng chung dây:", "mọi byte vi điều khiển gửi đi đều **vọng ngược lại** chân thu của chính nó. Khi đọc một thanh ghi, firmware nhận về 12 byte: 4 byte vọng của gói vừa gửi, rồi mới tới 8 byte trả lời của driver. Phải bỏ 4 byte đầu. Điện trở 1k có nhiệm vụ giới hạn dòng khi hai bên cùng lái đường dây."));

P(h2("4.3 Cấu trúc gói tin và CRC"));
P(...code([
  "Gói đọc thanh ghi, vi điều khiển gửi 4 byte:",
  "    [0x05] [địa chỉ] [mã thanh ghi] [CRC]",
  "",
  "Driver trả lời 8 byte:",
  "    [0x05] [0xFF] [mã thanh ghi] [D3] [D2] [D1] [D0] [CRC]",
  "                                  └─ dữ liệu 32 bit, byte cao trước ─┘",
]));
P(...def("CRC:", "viết tắt của Cyclic Redundancy Check, một con số tính ra từ toàn bộ nội dung gói tin theo một công thức cố định. Bên gửi tính rồi đính kèm, bên nhận tính lại và so. Khớp thì gần như chắc chắn gói tin không bị lỗi đường truyền. CRC không phải để bảo mật, chỉ để phát hiện nhiễu. TMC2209 dùng CRC 8 bit và datasheet có sẵn đoạn code mẫu."));
P(p("Byte đầu tiên luôn là 0x05, gọi là byte đồng bộ. Driver dựa vào nó để **tự dò tốc độ baud**: nó đo độ dài các bit trong byte này rồi tự chỉnh theo. Nhờ vậy không cần cấu hình baud cho driver, muốn đổi tốc độ chỉ cần sửa phía vi điều khiển."));

P(h2("4.4 Các thanh ghi đã cài và ý nghĩa"));
P(table(["Thanh ghi", "Giá trị đặt", "Ý nghĩa"],
  [["NODECONF", "SENDDELAY = 2", "buộc driver chờ lâu hơn trước khi trả lời, bắt buộc khi có nhiều driver chung một bus, để chúng không nói chồng lên nhau"],
   ["GCONF", "0x1C1", "bật ba bit: dùng chân PDN cho UART, lấy vi bước từ thanh ghi thay vì từ chân MS, và giữ dòng theo biến trở trên module"],
   ["CHOPCONF", "MRES = 4, intpol = 1", "chọn 1/16 vi bước và bật nội suy lên 1/256"],
   ["GSTAT", "ghi 0x7", "xoá ba cờ sự cố: vừa reset, lỗi driver, sụt áp bơm điện tích"],
   ["IFCNT", "chỉ đọc", "bộ đếm số lệnh ghi thành công, dùng để xác nhận lệnh đã tới nơi"],
   ["IOIN", "chỉ đọc", "trạng thái các chân, và 8 bit cao là mã phiên bản, luôn bằng 0x21 với TMC2209"]],
  [1.1, 1.2, 3.7]));
P(gap());
P(...note("Vì sao cần IFCNT:", "lệnh ghi qua UART **không có phản hồi**. Driver nhận được hay không, firmware không biết. IFCNT là bộ đếm tăng lên sau mỗi lệnh ghi hợp lệ, nên đọc nó trước và sau khi ghi, thấy tăng đúng số lần là biết chắc đã thành công. Đây là cách duy nhất để xác nhận."));

P(h2("4.5 Bốn lỗi đã gặp, không lỗi nào ở thuật toán"));
P(p("Bước này mất nhiều thời gian nhất cả dự án. Đáng chú ý là không có lỗi nào nằm ở phần tính toán:"));
P(num("**Chân PDN_UART trên module chưa thông.** Nhiều module StepStick để hở chân này, phải hàn một mối nối trên bo mạch thì mới dùng được UART. Triệu chứng đánh lừa: tiếng vọng vẫn về đủ 4 byte nên tưởng dây tốt, nhưng thực ra tiếng vọng chỉ chạy vòng trong vi điều khiển, chưa từng tới driver."));
P(num("**Điện trở 10k thay vì 1k.** Điện trở lớn làm sườn tín hiệu lên chậm, byte trả lời của driver bị lấy mẫu sai thời điểm, nhận về rác kiểu 0x50 thay vì 0x05. Để ý 0x50 chính là 0x05 bị dịch bit, dấu hiệu kinh điển của lấy mẫu sai."));
P(num("**Timeout để cứng 5 mili giây** trong khi baud là 9600. Gửi 8 byte ở 9600 baud mất 8.3 mili giây, tức hết giờ trước cả khi gửi xong. Đã sửa thành tự tính theo baud hiện hành."));
P(num("**Không có khoảng nghỉ giữa hai gói.** Datasheet ghi rõ driver còn giữ đường dây thêm bốn bit sau khi trả lời xong. Gửi gói kế tiếp ngay lập tức khiến hai bên cùng lái bus, byte nhận về bị lệch bit."));
P(p("Bài học chung, áp dụng cho mọi giao thức: **khi không chạy, đừng sửa thuật toán trước**. Hãy đo xem tín hiệu có tới nơi không và đếm xem nhận được bao nhiêu byte. Một biến toàn cục ghi lại từng byte của lần giao tiếp cuối cùng đã giúp tìm ra cả bốn lỗi trên."));

// ===================== 5 =====================
P(brk(), h1("5. Bước 1: một động cơ quay bằng timer"));
P(p("Mục tiêu nhỏ và rõ ràng: một động cơ quay đúng số bước được yêu cầu, xung do ngắt timer phát ra, và CPU vẫn rảnh để làm việc khác."));
P(h2("5.1 Cấu trúc chương trình"));
P(...code([
  "stepper_move_a(steps, speed):          // chạy ở vòng lặp chính",
  "    đặt chân DIR theo dấu của steps",
  "    chờ 10 µs cho DIR ổn định",
  "    steps_remaining = |steps|",
  "    ARR = 1000000 / speed              // chu kỳ, tính bằng µs",
  "    bật timer kèm ngắt",
  "",
  "ISR, mỗi lần ngắt là một bước:",
  "    bật chân STEP lên 1",
  "    hạ chân STEP xuống 0",
  "    position += chiều",
  "    steps_remaining--",
  "    nếu steps_remaining == 0 thì tắt timer",
]));
P(...note("Vì sao phải chờ sau khi đặt DIR:", "driver cần một khoảng thời gian ngắn để chốt mức DIR trước khi nhận xung STEP. Nếu đổi chiều rồi phát xung ngay lập tức, bước đầu tiên có thể đi sai chiều."));
P(h2("5.2 Phép thử và cách đọc kết quả"));
P(bullet("Chạy 1600 bước ở 1600 bước mỗi giây, tức 20 mm ở 20 mm/s. Động cơ phải quay rồi dừng đúng lúc, không quay thêm."));
P(bullet("Biến đếm vị trí phải đúng bằng 1600 sau khi chạy xong."));
P(bullet("Đi 20 mm rồi về 20 mm, vạch dấu bút trên puly phải trở lại đúng chỗ cũ. Đây là phép thử phát hiện mất bước."));
P(bullet("**Phép thử quan trọng nhất**: trong lúc động cơ quay, con LED nháy trong ngắt hệ thống vẫn phải nháy đều. Đó là bằng chứng CPU không bị chặn, tức kiến trúc dùng timer đã hoạt động đúng mục đích."));

// ===================== 6 =====================
P(brk(), h1("6. Bước 2: hai động cơ và thuật toán Bresenham"));
P(h2("6.1 Bài toán cần giải"));
P(p("Đi một đoạn thẳng bất kỳ, hai motor thường phải đi **số bước khác nhau**. Ví dụ một đoạn cần motor A đi 8 bước còn motor B đi 3 bước. Hai motor phải cùng khởi hành, cùng về đích, và quan trọng hơn: ba bước của B phải **rải đều** trong suốt hành trình, chứ không phải dồn cục ở đầu hay cuối, nếu không quỹ đạo sẽ cong chứ không thẳng."));
P(p("Cách làm sai thường thấy: cho mỗi motor một timer riêng, đặt tần số tỉ lệ với số bước. Hỏng vì hai timer không bao giờ đồng bộ hoàn hảo, và sai số tích luỹ theo thời gian."));
P(p("Cách làm đúng: **một timer duy nhất cho cả hai motor**. Mỗi lần ngắt gọi là một **nhịp**. Trong mỗi nhịp, firmware quyết định motor nào bước, motor nào đứng yên."));

P(h2("6.2 Ý tưởng: bộ tích luỹ phần dư"));
P(p("Vấn đề quy về: _phân bố đều 3 sự kiện vào 8 nhịp, chỉ dùng số nguyên_. Nếu được dùng số thực thì đơn giản, cứ 8 chia 3 bằng 2.67 nhịp lại cho một bước. Nhưng 2.67 không phải số nguyên, và dùng số thực trong ISR thì vi phạm nguyên tắc ở mục 1.6."));
P(p("Giải pháp là một **bộ tích luỹ**: mỗi nhịp cộng thêm một lượng cố định vào một biến đếm. Khi biến đó vượt ngưỡng thì phát một bước và trừ bớt ngưỡng đi. Phần dư được giữ lại, không bị vứt."));
P(...code([
  "n = max(|ΔA|, |ΔB|)            số nhịp của cả đoạn",
  "err_a = err_b = n / 2          khởi tạo ở giữa",
  "",
  "mỗi nhịp:",
  "    err_a += |ΔA|",
  "    nếu err_a >= n:  motor A bước,  err_a -= n",
  "",
  "    err_b += |ΔB|",
  "    nếu err_b >= n:  motor B bước,  err_b -= n",
]));
P(p("Motor đi nhiều bước hơn sẽ có số cộng vào bằng đúng n, nên nó bước ở **mọi nhịp**. Motor kia cộng ít hơn nên thỉnh thoảng mới đủ ngưỡng."));

P(h2("6.3 Chạy thử bằng tay"));
P(p("Với ΔA = 8 và ΔB = 3, nên n = 8. Bảng dưới là từng nhịp một, cột err là giá trị sau khi đã trừ ngưỡng:"));
P(table(["Nhịp", "err_b trước", "cộng 3", "≥ 8 ?", "B có bước", "err_b sau"],
  [["1", "4", "7", "không", "", "7"],
   ["2", "7", "10", "có", "✔", "2"],
   ["3", "2", "5", "không", "", "5"],
   ["4", "5", "8", "có", "✔", "0"],
   ["5", "0", "3", "không", "", "3"],
   ["6", "3", "6", "không", "", "6"],
   ["7", "6", "9", "có", "✔", "1"],
   ["8", "1", "4", "không", "", "4"]],
  [0.8, 1.2, 1, 1, 1.1, 1.1]));
P(gap());
P(p("Kết quả: B bước ở nhịp 2, 4 và 7. Đúng ba bước, và rải khá đều trong tám nhịp. Không có phép chia nào, không có số thực nào, chỉ cộng, so sánh và trừ."));
P(...figure("fig_bresenham.png", "Cùng ví dụ đó vẽ ra: motor A bước mọi nhịp, motor B bước ba lần rải đều. Đường mảnh là giá trị bộ tích luỹ, mỗi lần chạm ngưỡng thì rơi xuống và sinh một bước."));

P(h2("6.4 Vì sao gọi là Bresenham"));
P(p("Thuật toán này do Jack Bresenham công bố năm 1962 khi làm việc tại IBM, để giải một bài toán khác: **vẽ một đoạn thẳng trên màn hình**."));
P(p("Màn hình chỉ có các điểm ở toạ độ nguyên. Muốn vẽ đoạn thẳng từ điểm (0,0) tới (8,3), máy phải chọn 8 điểm, mỗi cột x một điểm, sao cho dãy điểm đó bám sát đường thẳng lý tưởng nhất. Cột x nào thì y tăng lên một đơn vị? Chính là câu hỏi _phân bố đều 3 lần tăng vào 8 cột_."));
P(p("Hai bài toán giống nhau về bản chất, nên dùng chung một lời giải. Điểm chung: **phải chia một số nguyên cho một số nguyên khác mà không được dùng số thực, và không được vứt phần dư**."));
P(...note("Triết lý đáng nhớ:", "không vứt phần dư, giữ lại dùng tiếp. Ý tưởng này sẽ xuất hiện lại lần nữa ở chương 7, trong biến `rest` của thuật toán gia tốc, dù đó là một bài toán hoàn toàn khác."));
P(p("Chi tiết khởi tạo `err = n/2` thay vì 0: nếu khởi tạo bằng 0 thì bước đầu tiên của motor chậm sẽ tới muộn hơn một chút so với lý tưởng. Khởi tạo ở giữa làm các bước phân bố cân đối hơn, chuyển động mượt hơn. Grbl cũng làm như vậy."));

P(h2("6.5 Hai chi tiết dễ sai"));
P(num("**Chiều dài đoạn phải đo trong mặt phẳng XY**, không đo trong không gian AB. Nếu lấy nhầm, tốc độ đầu in sẽ sai đúng hệ số 1.41 ở các hướng chéo, mà lại đúng ở hướng thẳng, nên rất khó phát hiện."));
P(num("**Số bước phải tính từ toạ độ đích tuyệt đối**, không cộng dồn từng đoạn đã làm tròn:"));
P(...code([
  "// Đúng: sai số làm tròn không bao giờ tích luỹ",
  "target_a = lroundf((x_đích + y_đích) * 80);",
  "steps_a  = target_a - pos_a;",
  "",
  "// Sai: mỗi đoạn mất một chút, hàng nghìn đoạn thì lệch thấy rõ",
  "steps_a = lroundf((dx + dy) * 80);",
]));

P(h2("6.6 Bỏ vòng chờ trong ngắt bằng kênh so sánh"));
P(p("Phiên bản đầu tiên bật chân STEP, chờ 2 micro giây bằng một vòng lặp rỗng, rồi hạ xuống. Chờ trong ngắt là lãng phí: CPU đứng im nhưng vẫn bị tính là bận, và không ai khác được chạy."));
P(...def("Kênh so sánh (compare channel):", "ngoài việc đếm tới ARR rồi phát ngắt, timer còn có thể phát thêm ngắt khi bộ đếm đi qua một giá trị trung gian. Đặt giá trị đó bằng 2 thì cứ 2 micro giây sau mỗi lần bắt đầu chu kỳ, một ngắt thứ hai được sinh ra. Dùng nó để hạ chân STEP, phần cứng đo thời gian thay cho CPU."));
P(...code([
  "        ngắt update (ARR)            ngắt compare (CC1)",
  "              │                            │",
  " STEP ────────┘‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾└──────────────",
  "              │◄────── 2 micro giây ──────►│",
  "        Bresenham,                     hạ cả hai chân",
  "        nâng chân STEP                 (hạ chân vốn đã thấp",
  "        của motor tới lượt              thì không tốn gì)",
]));
P(table(["Phiên bản", "CPU tốn cho mỗi bước", "Trần tốc độ mỗi motor"],
  [["Vòng chờ trong ngắt", "khoảng 5 µs", "100 kHz"], ["Dùng kênh so sánh", "khoảng 1 µs", "200 kHz"]],
  [1.5, 1.6, 1.6]));
P(gap());
P(...note("Chi tiết dễ bỏ sót:", "nếu tắt timer ngay khi hết bước thì ngắt so sánh không bao giờ tới, và chân STEP kẹt ở mức cao. Cần một cờ trạng thái: ngắt chính chỉ đánh dấu là sắp xong, ngắt so sánh hạ chân xuống rồi mới thật sự tắt timer."));

// ===================== 7 =====================
P(brk(), h1("7. Bước 3: gia tốc hình thang"));
P(h2("7.1 Vì sao không thể chạy ngay ở tốc độ đích"));
P(p("Rotor và puly có khối lượng, nên có quán tính. Muốn tăng tốc độ quay thì cần mômen, mà mômen của động cơ bước có hạn. Nếu ra lệnh chạy 150 mm/s ngay từ xung đầu tiên khi đang đứng yên, từ trường quay đi trước còn rotor không theo kịp, kết quả là rotor rung tại chỗ và **mất toàn bộ số bước**."));
P(...def("Pull-in rate:", "tốc độ cao nhất mà động cơ bước có thể khởi động tức thời từ trạng thái đứng yên mà không mất bước. Với tải thực tế của máy này, giá trị đó nằm khoảng 30 tới 50 mm/s. Đó đúng là trần tốc độ của máy trước khi làm bước này."));
P(p("Giải pháp là không bao giờ nhảy bậc, mà **tăng tốc từ từ** tới tốc độ mong muốn, rồi giảm dần trước khi dừng."));

P(h2("7.2 Hình dạng cần tạo và hai công thức"));
P(...figure("fig_trapezoid.png", "Bên trái: đoạn đủ dài nên đạt được tốc độ đặt, đồ thị hình thang. Bên phải: đoạn quá ngắn, hai dốc gặp nhau trước khi kịp đạt tốc độ đặt, đồ thị thành hình tam giác."));
P(p("Chỉ cần hai công thức vật lý phổ thông, áp dụng cho chuyển động gia tốc đều:"));
P(...code([
  "v = a · t                    tốc độ đạt được sau thời gian t",
  "s = v² / (2a)                quãng đường cần để đạt tốc độ v",
  "",
  "Dẫn công thức thứ hai:   t = v/a,  s = ½at² = ½a(v/a)² = v²/(2a)",
]));
P(p("Thay số thật của máy, chạy 150 mm/s với gia tốc 2000 mm/s²:"));
P(...code([
  "thời gian tăng tốc = 150 / 2000        = 0.075 giây",
  "quãng tăng tốc     = 150² / (2 × 2000) = 5.6 mm",
]));
P(p("Vậy một hành trình 100 mm chia thành: 5.6 mm tăng tốc, 88.8 mm chạy đều, 5.6 mm giảm tốc."));

P(h2("7.3 Đổi sang không gian nhịp"));
P(p("ISR không biết milimét, cũng không biết giây. Nó chỉ biết nhịp timer và micro giây. Cần một tỉ số quy đổi, và tỉ số đó có sẵn trong mỗi lệnh chạy:"));
P(...code([
  "ticks_per_mm = n / length_mm",
  "",
  "    n          số nhịp của đoạn, bằng max(|ΔA|, |ΔB|), đã tính sẵn cho Bresenham",
  "    length_mm  quãng đường đầu in đi trong XY, bằng căn(dx² + dy²)",
  "",
  "v_nhịp = v_mm × ticks_per_mm          a_nhịp = a_mm × ticks_per_mm",
]));
P(p("Kiểm tra thứ nguyên cho thấy phép đổi là hợp lệ: milimét trên giây nhân với nhịp trên milimét thì milimét triệt tiêu, còn lại nhịp trên giây."));
P(h3("Hệ số căn hai tự xuất hiện"));
P(p("Đây là điểm tinh tế đáng chú ý. Hai lệnh chạy cùng dài 3 mm nhưng khác hướng:"));
P(table(["Lệnh chạy", "ΔA", "ΔB", "n", "length", "ticks_per_mm"],
  [["Thẳng 3 mm theo X", "240", "240", "240", "3 mm", "80"],
   ["Chéo 45 độ, cũng 3 mm", "339", "0", "339", "3 mm", "113"]],
  [2.2, 0.9, 0.9, 0.9, 1, 1.5]));
P(gap());
P(p("Tỉ số 339 chia 240 bằng đúng 1.41. Hệ số căn hai xuất hiện mà **không ai viết nó vào code**, vì `n` đi qua phép biến đổi CoreXY nên mang theo đặc tính hình học của cơ cấu, còn `length_mm` thì không. Nếu sau này đổi sang cơ cấu khác, chỉ cần sửa công thức tính ΔA và ΔB, toàn bộ phần gia tốc không phải đụng tới."));

P(h2("7.4 Dãy chu kỳ và công thức truy hồi"));
P(p("Tăng tốc nghĩa là mỗi bước có chu kỳ ngắn hơn bước trước. Cần một dãy số c₀, c₁, c₂... Công thức chính xác suy ra từ quãng đường theo thời gian:"));
P(...code([
  "n = ½·a·t²     →     t_n = căn(2n / a)      thời điểm bước thứ n xảy ra",
  "c_n = t_(n+1) − t_n = căn(2/a) · (căn(n+1) − căn(n))",
]));
P(p("Công thức này đúng tuyệt đối nhưng chứa căn bậc hai, không thể chạy hàng chục nghìn lần mỗi giây trong ISR. Thuật toán của Atmel, công bố trong tài liệu ứng dụng **AVR446**, khai triển tỉ số hai chu kỳ liên tiếp và được xấp xỉ rất gọn:"));
P(...code([
  "  c_n          2",
  "─────── ≈ 1 − ──────        →      c_n = c_(n−1) − 2·c_(n−1) / (4n + 1)",
  "c_(n−1)       4n+1",
]));
P(p("Chỉ còn một phép nhân hai, một phép chia và một phép trừ. Căn bậc hai duy nhất còn lại là ở bước đầu tiên, và nó chạy một lần cho cả lệnh chạy, ở vòng lặp chính."));
P(...figure("fig_cn.png", "Dãy chu kỳ do công thức truy hồi số nguyên sinh ra, so với công thức chính xác có căn bậc hai. Hai đường gần như trùng nhau."));
P(p("Đọc đồ thị: chu kỳ co từ 2000 micro giây xuống 83 micro giây sau 450 bước, đúng bằng số nhịp tăng tốc đã tính. Lúc đầu giảm rất mạnh, càng về sau càng ì, vì tốc độ tăng theo căn bậc hai của quãng đường."));
P(table(["Bước thứ", "Chu kỳ c", "Tốc độ tương ứng"],
  [["0", "2000 µs", "6.2 mm/s"], ["1", "1200 µs", "10.4 mm/s"], ["2", "934 µs", "13.4 mm/s"],
   ["5", "631 µs", "19.8 mm/s"], ["11", "437 µs", "28.6 mm/s"], ["450", "83 µs", "150.6 mm/s"]],
  [1, 1.4, 1.8]));
P(gap());
P(...note("Vì sao chu kỳ đầu tiên bị chặn ở 2000 µs:", "công thức cho c₀ bằng 3536 micro giây, tương ứng 3.5 mm/s. Khởi động chậm như vậy là phí thời gian vì động cơ thừa sức bắt đầu ở 6 mm/s. Chặn lại giúp rút ngắn vài chục mili giây cho mỗi lệnh chạy."));

P(h2("7.5 Biến rest: chi tiết nhỏ quyết định thành bại"));
P(p("Phép chia trong ngôn ngữ C giữa hai số nguyên luôn cắt bỏ phần lẻ. Ở đây việc cắt bỏ không gây sai số nhỏ, mà làm hỏng hẳn thuật toán. Xét lúc đang ở nhịp 400 với chu kỳ 90 micro giây:"));
P(...code([
  "num = 2 × 90 = 180          den = 4 × 400 + 1 = 1601",
  "180 / 1601 = 0              phần nguyên bằng không",
]));
P(p("Không có cơ chế giữ phần dư, chu kỳ sẽ đứng im ở 90 micro giây **mãi mãi**. Đường dốc khựng lại, động cơ không bao giờ đạt được tốc độ đặt. Bảng dưới cho thấy sự khác biệt:"));
P(table(["Nhịp", "num khi không giữ dư", "Kết quả", "num khi có giữ dư", "Kết quả"],
  [["400", "180", "giảm 0", "180", "giảm 0, để dành 180"],
   ["401", "180", "giảm 0", "360", "giảm 0, để dành 360"],
   ["405", "180", "giảm 0", "1080", "giảm 0, để dành 1080"],
   ["409", "180", "giảm 0 mãi mãi", "1800", "**giảm được 1 µs**"]],
  [0.8, 1.6, 1.3, 1.5, 1.8]));
P(gap());
P(...code([
  "uint32_t num = 2U * c + rest;    // cộng phần để dành từ lần trước",
  "c  -= num / den;                  // lấy phần nguyên dùng ngay",
  "rest = num % den;                 // cất phần lẻ lại cho lần sau",
]));
P(p("Đúng ba dòng, và đây chính là ý tưởng của Bresenham ở chương trước, áp dụng cho một bài toán khác."));

P(h2("7.6 Khi đoạn quá ngắn: profile tam giác"));
P(p("Nếu quãng tăng tốc cộng quãng giảm tốc vượt quá chiều dài đoạn thì máy không bao giờ kịp đạt tốc độ đặt. Khi đó phải tính điểm hai dốc gặp nhau và đồ thị trở thành hình tam giác, như nửa phải của Hình 7."));
P(p("Đây là lý do thực tế khiến in chi tiết nhỏ luôn chậm hơn tốc độ đặt trong phần mềm cắt lớp. Đo trên máy này: đoạn 2 mm đặt 150 mm/s chỉ đạt đỉnh **75 mm/s**. Không phải máy yếu, mà là quãng đường quá ngắn để kịp tăng tốc."));

P(h2("7.7 Kết quả đo"));
P(table(["Lệnh chạy", "Tốc độ đỉnh đạt được", "Thời gian"],
  [["100 mm ở 150 mm/s, a = 2000", "150.6 mm/s", "728 ms"],
   ["2 mm ở 150 mm/s, a = 2000", "74.9 mm/s, tam giác", "50 ms"],
   ["100 mm ở 300 mm/s, a = 5000", "304.9 mm/s", "406 ms"],
   ["100 mm ở 600 mm/s", "bị từ chối, vượt trần 40 kHz", "—"]],
  [2.2, 1.9, 1.1]));

// ===================== 8 =====================
P(brk(), h1("8. Bước 5: hàng đợi và nhìn trước"));
P(h2("8.1 Vấn đề còn lại sau bước 3"));
P(p("Sau chương 7, mỗi lệnh chạy đều bắt đầu từ tốc độ 0 và kết thúc về 0. Với một lệnh dài thì không sao. Nhưng phần mềm cắt lớp sinh ra hàng nghìn đoạn ngắn, và một đường tròn chia thành 72 dây cung sẽ phải **dừng hẳn 72 lần**. Máy giật, ồn, và chậm gấp ba lần cần thiết."));
P(p("Nhưng cũng không thể cứ thế chạy thẳng qua mọi điểm nối. Ở một góc vuông, giữ nguyên tốc độ nghĩa là vận tốc đổi hướng tức thời, tương đương gia tốc vô hạn. Thực tế sẽ là một cú giật mạnh, đủ làm mất bước và rung cả khung."));
P(p("Câu hỏi thật sự là: **mỗi điểm nối được phép đi qua ở tốc độ nào?**"));

P(h2("8.2 Tốc độ qua góc"));
P(...def("Junction deviation:", "mô hình do grbl sử dụng. Tưởng tượng đầu in không bẻ góc nhọn mà đi theo một cung tròn nhỏ bo ở góc. Tham số junction deviation là **khoảng cách lớn nhất cho phép giữa đường bo đó và góc nhọn lý tưởng**, đơn vị milimét. Biết độ lệch cho phép thì suy ra bán kính cung, từ bán kính suy ra tốc độ tối đa để gia tốc hướng tâm không vượt quá giới hạn."));
P(...figure("fig_junction.png", "Góc càng nhọn thì cung bo càng nhỏ, nên tốc độ cho phép càng thấp. Số liệu tính với junction deviation 0.05 mm và gia tốc 2000 mm/s²."));
P(p("Công thức cuối cùng chỉ cần tích vô hướng của hai vector đơn vị chỉ hướng, không cần tính góc bằng hàm lượng giác:"));
P(...code([
  "cos θ   = − (vector_trước · vector_sau)",
  "sin(θ/2) = căn(0.5 · (1 − cos θ))",
  "",
  "v_góc = căn( a · junction_deviation · sin(θ/2) / (1 − sin(θ/2)) )",
]));
P(p("Đặt junction deviation lớn thì qua góc nhanh hơn nhưng góc bị bo tròn nhiều hơn. Giá trị 0.05 mm của dự án nằm giữa mức 0.01 mặc định của grbl và các giá trị thường dùng trong máy in 3D."));

P(h2("8.3 Hai lượt quét trên hàng đợi"));
P(p("Biết tốc độ cho phép tại từng góc vẫn chưa đủ, vì còn phải bảo đảm tính khả thi vật lý. Không thể vào một đoạn dài 1 mm ở tốc độ 150 mm/s rồi đòi dừng hẳn ở cuối đoạn, vì quãng đường không đủ để phanh."));
P(p("Vì vậy planner giữ một **hàng đợi** 32 đoạn, và mỗi khi có đoạn mới được xếp vào, nó quét lại toàn bộ hàng đợi hai lượt:"));
P(num("**Lượt lùi**, từ đoạn cuối về đầu: một đoạn không được vào nhanh hơn mức mà nó còn _phanh kịp_ để khớp với tốc độ vào của đoạn ngay sau. Áp dụng công thức v = căn(v_sau² + 2·a·s)."));
P(num("**Lượt tới**, từ đoạn đầu về cuối: cũng không được vào nhanh hơn mức mà đoạn trước _đẩy lên được_, cùng công thức nhưng theo chiều ngược lại."));
P(p("Sau hai lượt, mỗi đoạn có một tốc độ vào vừa thoả mãn giới hạn góc, vừa thoả mãn giới hạn gia tốc ở cả hai phía. Đoạn mà ISR đang chạy không bao giờ bị sửa, vì đường dốc của nó đã khởi động."));
P(...note("Vì sao phải hai lượt:", "một lượt là không đủ. Quét lùi bảo đảm phanh kịp, nhưng có thể đặt ra tốc độ vào mà đoạn trước không tài nào đẩy lên tới. Quét tới sửa nốt điều đó. Đây là kỹ thuật kinh điển trong mọi planner, từ grbl tới Marlin."));

P(h2("8.4 Nối liền hai đoạn trong ngắt"));
P(p("Khi một đoạn kết thúc, ISR nạp luôn đoạn kế tiếp mà không tắt timer. Nhưng công thức AVR446 ở chương 7 giả định đường dốc xuất phát từ đứng yên, trong khi ở đây đoạn mới bắt đầu ở một tốc độ khác 0."));
P(p("Giải pháp là đặt tốc độ vào và tốc độ ra lên **đúng vị trí của chúng trên một đường dốc ảo xuất phát từ 0**. Nếu tốc độ vào tương ứng với bước thứ 120 của một đường dốc từ đứng yên, thì bắt đầu đếm từ 120 thay vì từ 0. Hai số bù đó trong code tên là `i_offset` và `j_offset`."));
P(...code([
  "i_offset = v_vào² / (2a)      vị trí tương đương trên dốc ảo, lúc vào",
  "j_offset = v_ra²  / (2a)      vị trí tương đương trên dốc ảo, lúc ra",
  "",
  "tăng tốc:  den = 4 · (số nhịp đã đi + i_offset) + 1",
  "giảm tốc:  den = 4 · (số nhịp còn lại + j_offset) + 1",
]));
P(p("Nhờ vậy công thức truy hồi chạy tiếp liền mạch qua ranh giới hai đoạn, thay vì khởi động lại từ đầu."));

P(h2("8.5 Kết quả đo trên máy thật"));
P(...figure("fig_lookahead.png", "Đồ thị tốc độ khi chạy 100 mm chia thành 20 đoạn. Có nhìn trước, máy tăng tốc một lần rồi giữ nguyên. Không có, máy phải dừng hẳn 19 lần."));
P(table(["Cách gửi lệnh", "Thời gian", "Nguồn số liệu"],
  [["Một đoạn 100 mm", "728 ms", "đo trên máy"],
   ["Hai mươi đoạn 5 mm", "728 ms", "đo trên máy"],
   ["Hai mươi đoạn, nếu dừng ở mỗi điểm nối", "1633 ms", "mô phỏng"],
   ["Đường tròn bán kính 20 mm, 72 dây cung", "nhanh hơn 3.6 lần", "mô phỏng"]],
  [2.4, 1.1, 1.4]));
P(gap());
P(p("Hai con số đầu bằng nhau tuyệt đối. Đây là kết quả quan trọng nhất của cả dự án: **chia nhỏ quãng đường không còn tốn thêm thời gian**, nghĩa là firmware đã sẵn sàng nhận dữ liệu thật từ phần mềm cắt lớp."));

// ===================== 9 =====================
P(brk(), h1("9. Bước 4: đọc lệnh G-code"));
P(h2("9.1 G-code là gì"));
P(...def("G-code:", "ngôn ngữ điều khiển máy công cụ, ra đời từ thập niên 1950 và được chuẩn hoá thành ISO 6983. Mỗi dòng là một lệnh, gồm các chữ cái kèm số. Chữ cái cho biết loại tham số, số là giá trị. Rất đơn giản về cú pháp, nhưng có đặc tính **modal**: một thiết lập giữ nguyên hiệu lực cho tới khi bị đổi."));
P(...code([
  "G1 X30 Y20 F6000      đi thẳng tới (30, 20), tốc độ 6000 mm mỗi phút",
  "G1 X40                đi tới X = 40, Y giữ nguyên, tốc độ vẫn 6000",
  "G0 X0 Y0              di chuyển nhanh, dùng khi không in",
  "G2 X30 Y0 I-15 J0     cung tròn thuận chiều kim đồng hồ, tâm lệch (I, J)",
  "G90 / G91             chuyển sang toạ độ tuyệt đối / tương đối",
  "G92 X0 Y0             đặt điểm hiện tại làm gốc, không di chuyển",
]));
P(...note("Một cái bẫy đơn vị:", "G-code tính tốc độ bằng **milimét mỗi phút**, còn firmware tính bằng milimét mỗi giây. Parser phải chia cho 60. Quên chi tiết này thì máy chạy nhanh gấp 60 lần lệnh, hậu quả có thể là hỏng cơ khí."));

P(h2("9.2 Vì sao cần lớp motion_control riêng"));
P(p("Mọi hình đều quy về đoạn thẳng. Hình vuông là 4 đoạn, đường tròn là 72 đoạn. Bộ phát xung **không hề biết** nó đang vẽ hình gì, và đó là điều tốt."));
P(p("Lớp motion_control nằm giữa parser và planner, lo hai việc: giữ vị trí tuyệt đối hiện tại, và chia cung tròn thành các dây cung. Số đoạn không chọn tuỳ tiện mà tính từ sai lệch cho phép:"));
P(...figure("fig_arc.png", "Sai lệch e giữa dây cung và cung tròn thật. Từ công thức gần đúng e ≈ r·θ²/8 suy ra góc mỗi đoạn, rồi ra số đoạn.", 4.0));
P(...code([
  "dung sai dùng trong dự án: 0.002 mm, giống grbl",
  "θ = căn(8 × 0.002 / r)",
  "",
  "r = 5 mm   →  θ = 0.057 rad  →  110 đoạn cho một vòng tròn",
  "r = 50 mm  →  θ = 0.018 rad  →  349 đoạn cho một vòng tròn",
]));
P(p("Cung bán kính lớn tự được chia mịn hơn, đúng như cần. Lưu ý dung sai 0.002 mm nhỏ hơn cả độ phân giải 0.0125 mm của máy, nên về hình học là dư sức."));
P(...note("Minh chứng cho việc tách lớp đúng:", "khi thêm hỗ trợ cung tròn G2 và G3, file stepper.c **không phải sửa một dòng nào**. Toàn bộ thay đổi nằm trong motion_control.c và gcode.c."));

P(h2("9.3 Bỏ qua thay vì báo lỗi"));
P(p("Parser chấp nhận rồi bỏ qua các chữ Z, E, M, S, T và N. Máy hiện chỉ có hai trục XY, nhưng file thật từ phần mềm cắt lớp luôn chứa lệnh cho trục Z và đầu đùn. Bỏ qua thay vì báo lỗi cho phép chạy thử file thật ngay, và khi nào làm trục Z thì chỉ cần thêm xử lý vào đúng chỗ đó."));

P(h2("9.4 Kết quả chạy thật"));
P(p("File thử nghiệm gồm một hình vuông, một ngôi sao năm cánh với các góc rất nhọn, một đường tròn viết bằng **một lệnh G2 duy nhất**, một hình chữ nhật bo bốn góc bằng cung G3, và một zigzag hai mươi đoạn ngắn."));
P(table(["Chỉ số", "Giá trị"],
  [["Số dòng G-code", "48"], ["Số lỗi cú pháp", "0"],
   ["Số đoạn thẳng sau khi chia cung", "355"], ["Tổng quãng đường", "799 mm"],
   ["Thời gian chạy", "9.4 giây"], ["Vùng làm việc", "60 × 63 mm"],
   ["Vị trí khi kết thúc", "đúng gốc, hai bộ đếm motor về 0"]],
  [2.2, 1.8]));

// ===================== 10 =====================
P(brk(), h1("10. Nhận lệnh qua cổng USB"));
P(h2("10.1 USB CDC là gì"));
P(...def("USB CDC:", "Communication Device Class, một lớp thiết bị chuẩn của USB. Khi vi điều khiển khai báo mình thuộc lớp này, hệ điều hành tự tạo ra một **cổng COM ảo**. Phần mềm trên máy tính mở cổng đó và đọc ghi như thể đang dùng cổng nối tiếp RS-232 cổ điển, không cần cài driver riêng. Tốc độ baud khai báo chỉ là hình thức, dữ liệu thực tế chạy ở tốc độ USB."));
P(p("Lý do chọn CDC thay vì UART thường: không cần mạch chuyển USB sang UART, tốc độ cao hơn nhiều, và cắm thẳng dây USB-C có sẵn trên bo."));

P(h2("10.2 Giao thức dòng lệnh"));
P(p("Máy tính gửi từng dòng G-code kết thúc bằng ký tự xuống dòng, bo trả lời `ok` nếu nhận và xếp hàng thành công, hoặc `error` kèm mã lỗi. Ngoài ra có bốn ký tự được xử lý **ngay lập tức trong ngắt USB**, không đi qua hàng đợi:"));
P(table(["Ký tự", "Tác dụng", "Vì sao phải xử lý ngay"],
  [["?", "báo trạng thái: đang chạy hay rảnh, toạ độ, chỗ trống trong hàng đợi", "để hỏi lúc nào cũng được, kể cả khi hàng đợi đầy"],
   ["!", "dừng khẩn: xoá hàng đợi và tắt timer tức thì", "nếu xếp hàng thì phải chờ hết mọi lệnh trước, vô nghĩa"],
   ["~", "bỏ trạng thái dừng khẩn, cho chạy tiếp", "đối ứng với lệnh trên"],
   ["Ctrl-X", "reset mềm, đưa mọi thứ về trạng thái đầu", "lối thoát cuối cùng khi rối loạn"]],
  [0.8, 2.4, 2.4]));
P(gap());
P(...note("Chi tiết dễ quên sau khi dừng khẩn:", "phải kéo vị trí mà planner đang tin về đúng vị trí thật mà động cơ đã dừng. Nếu không, lệnh tiếp theo sẽ tính quãng đường từ một toạ độ sai và đầu in nhảy một cú lớn."));

P(h2("10.3 Vì sao không chờ ok từng dòng"));
P(p("Cách đơn giản nhất là gửi một dòng rồi chờ `ok`, xong mới gửi dòng tiếp theo. Cách này sai về mặt hiệu năng, và sai nghiêm trọng."));
P(p("Lý do: mỗi lần chờ, hàng đợi của planner cạn dần. Khi hàng đợi chỉ còn một đoạn, planner **không còn gì để nhìn trước**, nên buộc phải giả định đoạn đó là đoạn cuối và cho dừng hẳn ở cuối đoạn. Toàn bộ công sức của chương 8 mất sạch."));
P(...def("Đếm ký tự (character counting):", "kỹ thuật các script gửi file của grbl dùng. Máy tính biết bộ đệm nhận của bo lớn bao nhiêu byte, ở đây là 256. Nó cứ gửi tiếp chừng nào tổng số byte chưa được xác nhận còn nhỏ hơn 256, và mỗi lần nhận `ok` thì trừ đi độ dài dòng tương ứng. Nhờ vậy trên đường truyền luôn có vài dòng đang bay, và hàng đợi của planner luôn đầy."));

P(h2("10.4 Trạng thái hiện tại"));
P(p("Phía vi điều khiển đã kiểm tra xong bằng cách đọc trực tiếp các thanh ghi trên chip đang chạy: clock USB đúng 48 MHz lấy từ bộ nhân tần, nguồn 3.3V riêng cho USB đã sẵn sàng, ngắt đã bật, hàm nhận đã nối vào parser."));
P(p("Máy tính nhìn thấy có thiết bị cắm vào nhưng chưa đọc được bản mô tả thiết bị, báo lỗi -71. Vì phần vi điều khiển đã được xác nhận đúng, nghi vấn còn lại nằm ở đường dây tín hiệu D+ và D−. Đây là hạng mục duy nhất trong tài liệu chưa hoàn tất."));

// ===================== 11 =====================
P(brk(), h1("11. Phương pháp làm việc"));
P(h2("11.1 Mô phỏng trước khi nạp"));
P(p("Thói quen đáng giá nhất của cả dự án: **viết lại thuật toán bằng Python và chạy thử trên máy tính trước khi nạp xuống bo**, dùng đúng phép toán số nguyên như trong ISR, kể cả phép chia lấy phần nguyên."));
P(p("Nhờ vậy, cả profile gia tốc lẫn thuật toán nhìn trước đều được kiểm chứng trước khi động cơ quay lần đầu. Khi chạy thật, số đo khớp với mô phỏng tới từng mili giây: mô phỏng 725 ms, đo được 728 ms."));
P(p("Lợi ích thứ hai, ít ai để ý: mô phỏng trả lời rất nhanh các câu hỏi thiết kế. Đoạn 2 mm ở tốc độ đặt 150 mm/s thực tế đạt bao nhiêu? Chia đường tròn thành bao nhiêu đoạn là đủ? Những câu đó trả lời trong vài giây mà không cần nạp lại firmware."));

P(h2("11.2 Thiết kế biến debug cho đúng"));
P(p("Trong lúc tìm lỗi giao tiếp UART, một biến toàn cục ghi lại toàn bộ lần giao tiếp cuối cùng đã giúp phân biệt rõ ràng ba giả thuyết khác nhau:"));
P(table(["Số byte nhận được", "Kết luận"],
  [["0 byte", "không có cả tiếng vọng, lỗi nằm ở dây hoặc cấu hình chân vi điều khiển"],
   ["4 byte, đúng bằng gói vừa gửi", "tiếng vọng tốt nhưng driver im lặng: lỗi nguồn, địa chỉ, hoặc chân PDN chưa thông"],
   ["12 byte nhưng nội dung sai", "tín hiệu bị méo: lỗi mức điện áp, điện trở, hoặc tốc độ"]],
  [1.4, 3.4]));
P(gap());
P(...note("Nguyên tắc rút ra:", "biến debug phải **phân biệt được các giả thuyết**, không chỉ báo thành công hay thất bại. Một biến trả về 'lỗi' không giúp gì. Một biến cho biết nhận được bao nhiêu byte và nội dung ra sao thì thu hẹp phạm vi tìm kiếm ngay lập tức."));

P(h2("11.3 Nạp và chạy thử bằng một lệnh"));
P(p("Script `tools/flash_run.sh` đọc địa chỉ biến từ file chương trình bằng công cụ `nm`, nạp firmware, chờ chip khởi động xong rồi ghi thẳng vào ô nhớ để kích hoạt phép thử, sau đó **ngắt kết nối** để mạch nạp không nằm trên bus khi động cơ chạy."));
P(p("Ba chi tiết khiến nó hoạt động được:"));
P(bullet("Phải **chờ sau khi reset** rồi mới ghi, vì vùng nhớ dữ liệu bị khởi tạo lại trong lúc chip khởi động, ghi sớm là mất trắng."));
P(bullet("Dùng lệnh ghi **một byte** cho biến một byte. Ghi cả bốn byte sẽ đè lên các biến nằm kế bên trong bộ nhớ."));
P(bullet("Đọc địa chỉ từ file chương trình **mỗi lần chạy**, vì địa chỉ thay đổi sau mỗi lần biên dịch."));

P(h2("11.4 Quy trình chuẩn cho mỗi bước"));
P(num("Viết thuật toán, mô phỏng bằng Python, kiểm tra kết quả có hợp lý không."));
P(num("Viết firmware, biên dịch cho tới khi không còn cảnh báo nào."));
P(num("Nạp và chạy phép thử nhỏ nhất có thể, thường là một chuyển động vài chục milimét ở tốc độ thấp."));
P(num("Đọc biến debug, đối chiếu với kết quả mô phỏng."));
P(num("Chỉ khi hai bên khớp mới lưu lại và chuyển sang bước tiếp theo."));

// ===================== 12 =====================
P(brk(), h1("12. Tổng hợp lỗi đã gặp"));
P(p("Phần này có giá trị thực dụng cao hơn phần lý thuyết, vì đây là những thứ không có trong sách vở."));
P(table(["Hiện tượng quan sát được", "Nguyên nhân thật sự", "Bài học rút ra"],
  [["Driver không trả lời UART", "pad UART trên module chưa hàn", "tiếng vọng không chứng minh dây đã tới driver"],
   ["Byte nhận về bị lệch bit", "điện trở 10k làm sườn tín hiệu chậm", "dùng đúng giá trị nhà sản xuất khuyến nghị"],
   ["Gửi gói thất bại ngay từ đầu", "timeout cố định 5 ms trong khi baud 9600", "mọi thời hạn phải tính theo tham số đang dùng, không để cứng"],
   ["Gói thứ hai trở đi nhận ra rác", "driver giữ bus thêm 4 bit sau khi trả lời", "đọc kỹ phần định thời trong datasheet, không chỉ phần định dạng"],
   ["Động cơ không quay dù hàm báo thành công", "đặt tốc độ 2000 mm/s, động cơ rung tại chỗ", "giới hạn phải đặt theo khả năng vật lý, không chỉ theo giới hạn CPU"],
   ["Mất kết nối mạch nạp khi chạy nhanh", "nhiễu từ động cơ lọt vào dây SWD", "dây debug phải ngắn và xoắn với dây mát"],
   ["Mất bước ở tốc độ trên 50 mm/s", "chưa có gia tốc", "pull-in rate là giới hạn vật lý thật, không vượt được bằng phần mềm"],
   ["Chu kỳ đầu tiên của mỗi lệnh bị sai", "thanh ghi ARR có cơ chế preload", "đọc kỹ cơ chế nạp giá trị của timer"],
   ["Máy tính không nhận thiết bị USB", "chưa rõ, nghi đường dây D+ và D−", "loại trừ từng lớp, bắt đầu từ chỗ đo được"]],
  [1.9, 2.1, 2.6]));
P(gap());
P(h2("12.1 Ba nguyên tắc rút ra"));
P(num("**Khi có lỗi, đo trước khi sửa code.** Toàn bộ lỗi giao tiếp UART đều nằm ở phần cứng hoặc tham số cấu hình. Không có lỗi nào ở thuật toán."));
P(num("**Mỗi lớp chỉ nói một thứ tiếng.** Lớp trên dùng milimét và số thực, lớp dưới dùng nhịp và số nguyên, và chỉ có đúng một hàm làm nhiệm vụ phiên dịch. Nhờ vậy khi đọc code không bao giờ phải đoán đơn vị."));
P(num("**Có số đo cũ thì sửa code mới an toàn.** Khi dọn dẹp hai biến đếm thành một, chạy lại đúng hai phép thử cũ và thấy vẫn ra 728 ms là biết ngay không làm hỏng gì. Không có số đo tham chiếu thì mọi lần sửa đều là đánh cược."));

// ===================== 13 =====================
P(brk(), h1("13. Phụ lục"));
P(h2("13.1 Thông số máy"));
P(table(["Hạng mục", "Giá trị"],
  [["Vi điều khiển", "STM32H743IIT6, lõi Cortex-M7, 480 MHz, bo lõi FK743M2"],
   ["Driver trục X và Y", "2 × TMC2209, điều khiển qua UART một dây, địa chỉ 0 và 1"],
   ["Cơ cấu truyền động", "đai GT2 bước 2 mm, puly 20 răng, 40 mm mỗi vòng"],
   ["Vi bước", "1/16, có nội suy lên 1/256 bên trong driver"],
   ["steps_per_mm", "80"],
   ["Độ phân giải", "0.0125 mm"],
   ["Timer phát xung", "TIM2, một nhịp bằng 1 micro giây"],
   ["Độ rộng xung STEP", "2 micro giây, do kênh so sánh tạo ra"],
   ["Trần tốc độ mỗi motor", "40 kHz, tương đương 500 mm/s khi đi thẳng"],
   ["Gia tốc mặc định", "2000 mm/s²"],
   ["Junction deviation", "0.05 mm"],
   ["Dung sai chia cung", "0.002 mm"],
   ["Độ sâu hàng đợi", "32 đoạn"],
   ["Bộ đệm nhận lệnh", "256 byte"]],
  [1.5, 2.9]));
P(gap());

P(h2("13.2 Các công thức gom lại"));
P(...code([
  "ĐỘNG HỌC",
  "  ΔA = ΔX + ΔY                     ΔB = ΔX − ΔY",
  "  ΔX = (ΔA + ΔB)/2                 ΔY = (ΔA − ΔB)/2",
  "",
  "BRESENHAM",
  "  n = max(|ΔA|, |ΔB|)              err khởi tạo = n/2",
  "  err += |Δ|;  nếu err ≥ n thì bước và err −= n",
  "",
  "QUY ĐỔI ĐƠN VỊ",
  "  ticks_per_mm = n / length_mm",
  "  v_nhịp = v_mm × ticks_per_mm     a_nhịp = a_mm × ticks_per_mm",
  "",
  "GIA TỐC",
  "  quãng tăng tốc  s = v² / (2a)",
  "  chu kỳ đầu      c0 = F × căn(2/a)",
  "  truy hồi        c = c − (2c + rest) / (4i + 1)",
  "  điểm đỉnh tam giác  = (2·a·n + v_ra² − v_vào²) / (4a)",
  "",
  "NHÌN TRƯỚC",
  "  tốc độ khả thi  v = căn(v_trước² + 2·a·s)",
  "  tốc độ qua góc  v = căn(a · jd · sin(θ/2) / (1 − sin(θ/2)))",
  "",
  "CHIA CUNG TRÒN",
  "  sai lệch  e ≈ r·θ²/8      →      θ = căn(8e/r)",
]));

P(h2("13.3 Mã nguồn nên đọc tiếp"));
P(bullet("**grbl**, nên đọc đầu tiên vì nhỏ và sáng sủa. File `planner.c` cho phần nhìn trước, `stepper.c` cho phần phát xung, `motion_control.c` cho phần chia cung tròn."));
P(bullet("**grblHAL**, bản grbl viết lại có lớp trừu tượng phần cứng, có sẵn driver cho dòng STM32H7, hữu ích khi cần tách phần phụ thuộc chip."));
P(bullet("**Marlin**, phức tạp hơn nhiều nhưng đáng đối chiếu: `planner.cpp` và `stepper.cpp`."));
P(bullet("**Klipper**, cách tiếp cận hoàn toàn khác: máy tính Linux tính toán, vi điều khiển chỉ phát xung theo lịch đã lập sẵn. Đọc `kinematics/corexy.py` và `chelper/kin_corexy.c`."));
P(bullet("**Atmel AVR446**, tài liệu gốc của thuật toán gia tốc, và bài báo của David Austin đăng năm 2005 trên Embedded Systems Programming."));

P(h2("13.4 Tình trạng dự án"));
P(table(["Hạng mục", "Trạng thái"],
  [["Cấu hình TMC2209 qua UART", "xong, đã xác nhận trên máy"],
   ["Phát xung hai motor, động học CoreXY", "xong"],
   ["Gia tốc hình thang", "xong"],
   ["Hàng đợi và nhìn trước", "xong"],
   ["Parser G-code và chia cung tròn", "xong"],
   ["Nhận lệnh qua USB", "firmware xong, còn vướng đường dây USB"],
   ["Về gốc bằng cảm biến tiệm cận", "chưa làm"],
   ["Trục Z và đầu đùn", "chưa làm"],
   ["Đo nhiệt độ và vòng điều khiển PID", "chưa làm"],
   ["Khử rung bằng input shaping", "chưa làm"],
   ["Vẽ mạch in", "chưa làm"]],
  [2.4, 1.6]));

// ===================== build =====================
const doc = new Document({
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: convertInchesToTwip(0.32), hanging: convertInchesToTwip(0.19) } } } }] },
      { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: convertInchesToTwip(0.34), hanging: convertInchesToTwip(0.21) } } } }] },
    ],
  },
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22, color: INK }, paragraph: { spacing: { line: 310 } } },
      heading1: { run: { font: "Calibri", size: 34, bold: true, color: ACCENT }, paragraph: { spacing: { before: 360, after: 160 } } },
      heading2: { run: { font: "Calibri", size: 27, bold: true, color: "123E41" } },
      heading3: { run: { font: "Calibri", size: 23, bold: true, color: "123E41" } },
    },
  },
  sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: body }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(process.argv[2] || "out.docx", buf);
  console.log("written", (buf.length / 1024).toFixed(0), "KB,", figNo, "hình");
});
