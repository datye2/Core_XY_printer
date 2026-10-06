const fs = require("fs");
const d = require("docx");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  TableOfContents, PageBreak, LevelFormat, convertInchesToTwip,
} = d;

const INK = "1A1A1A";
const MUTED = "5A6862";
const ACCENT = "0B5E63";
const CODEBG = "F2F4F2";
const NOTEBG = "FFF6E0";

// ---------- helpers ----------
const h1 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 } });
const h2 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 } });
const h3 = (t) => new Paragraph({ text: t, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } });

function rich(text) {
  // **bold** segments
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((s) => s.length);
  return parts.map((s) =>
    s.startsWith("**")
      ? new TextRun({ text: s.slice(2, -2), bold: true, color: INK })
      : new TextRun({ text: s, color: INK })
  );
}

const p = (t) => new Paragraph({ children: rich(t), spacing: { after: 120, line: 300 } });

const bullet = (t) =>
  new Paragraph({ children: rich(t), numbering: { reference: "bullets", level: 0 }, spacing: { after: 60, line: 290 } });

const num = (t) =>
  new Paragraph({ children: rich(t), numbering: { reference: "steps", level: 0 }, spacing: { after: 60, line: 290 } });

function code(lines) {
  return lines.map((ln, i) =>
    new Paragraph({
      children: [new TextRun({ text: ln === "" ? " " : ln, font: "Consolas", size: 18, color: "173A3D" })],
      shading: { type: ShadingType.CLEAR, fill: CODEBG },
      spacing: { before: i === 0 ? 100 : 0, after: i === lines.length - 1 ? 140 : 0, line: 250 },
      indent: { left: 180, right: 180 },
    })
  );
}

function note(title, text) {
  return [
    new Paragraph({
      children: [new TextRun({ text: title + " ", bold: true, color: "8A6200" }), ...rich(text)],
      shading: { type: ShadingType.CLEAR, fill: NOTEBG },
      spacing: { before: 120, after: 160, line: 290 },
      indent: { left: 180, right: 180 },
      border: {
        left: { style: BorderStyle.SINGLE, size: 18, color: "D99A00", space: 8 },
      },
    }),
  ];
}

const TOTAL = 9360; // table width in DXA for A4 with 1" margins

function table(headers, rows, weights) {
  const w = weights || headers.map(() => 1);
  const sum = w.reduce((a, b) => a + b, 0);
  const widths = w.map((x) => Math.round((TOTAL * x) / sum));
  widths[widths.length - 1] = TOTAL - widths.slice(0, -1).reduce((a, b) => a + b, 0);

  const cell = (text, i, isHead) =>
    new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      shading: isHead ? { type: ShadingType.CLEAR, fill: "E4EDEC" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: String(text), bold: !!isHead, size: 19, color: INK })],
          spacing: { after: 0, line: 260 },
        }),
      ],
    });

  return new Table({
    columnWidths: widths,
    width: { size: TOTAL, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((t, i) => cell(t, i, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((t, i) => cell(t, i, false)) })),
    ],
  });
}

const gap = () => new Paragraph({ text: "", spacing: { after: 100 } });

// ---------- content ----------
const body = [];
const P = (...xs) => body.push(...xs.flat());

// cover
P(
  new Paragraph({ text: "", spacing: { after: 1200 } }),
  new Paragraph({
    children: [new TextRun({ text: "Firmware điều khiển máy in 3D CoreXY", bold: true, size: 56, color: ACCENT })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "Tài liệu đào tạo: từ khái niệm cơ bản tới firmware đã chạy thật", size: 28, color: MUTED })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "Dự án: bo điều khiển CoreXY tự thiết kế", size: 24, color: INK })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "Phần cứng: STM32H743IIT6 (FK743M2) · 2 × TMC2209 · 3 × A4988", size: 24, color: INK })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "Mã nguồn: github.com/datye2/Core_XY_printer", size: 22, color: MUTED })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "Phiên bản tháng 10 năm 2026", size: 22, color: MUTED })],
    alignment: AlignmentType.CENTER,
  }),
  new Paragraph({ children: [new PageBreak()] })
);

// TOC
P(
  new Paragraph({ text: "Mục lục", heading: HeadingLevel.HEADING_1, spacing: { after: 160 } }),
  new TableOfContents("Mục lục", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({ children: [new PageBreak()] })
);

// ---- 0. Về tài liệu
P(h1("0. Tài liệu này dành cho ai"));
P(p("Tài liệu ghi lại toàn bộ quá trình xây dựng firmware điều khiển cho một máy in 3D CoreXY, viết từ đầu, không dùng Marlin, Klipper hay RepRapFirmware. Mọi thứ trình bày ở đây đều đã chạy thật trên bo mạch và có số liệu đo kèm theo."));
P(p("Người đọc chỉ cần biết lập trình C ở mức cơ bản và đã từng nháy một con LED trên vi điều khiển. **Không cần biết gì về lý thuyết điều khiển**: mọi khái niệm sẽ được giải thích khi dùng tới lần đầu, kèm con số cụ thể của chính cái máy này."));
P(p("Cách đọc: các chương 1 tới 3 là nền tảng, nên đọc tuần tự. Từ chương 4 trở đi, mỗi chương là một bước phát triển đã làm, theo đúng thứ tự thời gian, và mỗi bước đều kết thúc bằng phép thử để biết nó đã chạy đúng hay chưa."));
P(...note("Nguyên tắc xuyên suốt:", "không viết thêm một dòng code nào cho bước sau khi bước hiện tại chưa chạy được trên phần cứng thật và chưa có số đo chứng minh."));

// ---- 1. Khái niệm cơ bản
P(h1("1. Những khái niệm cơ bản"));

P(h2("1.1 Động cơ bước là gì"));
P(p("Động cơ thường quay liên tục khi được cấp điện. Động cơ bước thì khác: nó quay theo **từng nấc rời rạc**. Loại NEMA17 dùng trong máy in 3D có 200 nấc cho một vòng, tức mỗi nấc là 1.8 độ."));
P(p("Bên trong có hai cuộn dây. Cấp dòng vào cuộn này rồi cuộn kia theo đúng thứ tự thì rotor bị kéo quay từng nấc. Ưu điểm lớn nhất: **biết chắc nó quay bao nhiêu mà không cần cảm biến phản hồi**. Ra lệnh 200 nấc là nó quay đúng một vòng."));
P(p("Nhược điểm nằm ngay cạnh ưu điểm đó: nếu tải quá nặng hoặc ra lệnh quay quá nhanh, động cơ **trượt bước** mà không ai biết. Firmware vẫn tưởng mọi thứ ổn. Đây là lý do phần lớn công sức trong tài liệu này dành cho việc ra lệnh sao cho động cơ luôn theo kịp."));

P(h2("1.2 Driver và hai sợi dây STEP, DIR"));
P(p("Vi điều khiển không cấp dòng trực tiếp cho động cơ. Nó nói chuyện với một mạch trung gian gọi là driver, ở đây là TMC2209. Giao tiếp chỉ gồm hai dây:"));
P(bullet("**DIR**: mức logic quyết định chiều quay. 0 là một chiều, 1 là chiều ngược lại."));
P(bullet("**STEP**: mỗi xung lên rồi xuống làm động cơ nhích đúng một nấc."));
P(p("Toàn bộ nhiệm vụ của firmware, rút gọn tới tận cùng, chỉ là: **phát xung STEP vào đúng thời điểm**. Khoảng cách giữa hai xung quyết định tốc độ. Xung thưa thì chậm, xung mau thì nhanh."));
P(...code([
  "DIR  ___|‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾   chiều quay",
  "",
  "STEP ______|‾|_______|‾|_______|‾|______         3 nấc, tốc độ đều",
  "",
  "STEP ___|‾|____|‾|__|‾|_|‾|_|‾|_                 đang tăng tốc",
]));

P(h2("1.3 Vi bước"));
P(p("Nếu chỉ dùng 200 nấc một vòng thì chuyển động rất giật và ồn. Driver có thể chia nhỏ mỗi nấc bằng cách điều khiển dòng trong hai cuộn dây theo dạng hình sin, gọi là **vi bước**."));
P(p("Máy này dùng 1/16 vi bước, tức mỗi nấc cơ khí được chia thành 16 bước nhỏ. Một vòng động cơ cần 200 × 16 = 3200 xung."));
P(...note("Hiểu đúng về vi bước:", "vi bước làm chuyển động **mượt hơn**, chứ không làm máy **chính xác hơn**. Lực giữ của mỗi vi bước tỉ lệ với sin của góc, nên ở mức 1/16 thì mỗi vi bước chỉ còn khoảng 10% lực giữ. Chia nhỏ hơn nữa thì ma sát của máy nuốt hết, động cơ không thực sự dừng đúng chỗ đó."));

P(h2("1.4 Quy đổi ra milimét: hằng số steps/mm"));
P(p("Người dùng nghĩ bằng milimét, động cơ nghĩ bằng số bước. Cầu nối là cơ cấu truyền động. Máy này dùng dây đai GT2 và puly 20 răng:"));
P(...code([
  "chu vi puly   = 20 răng × 2 mm  = 40 mm cho mỗi vòng",
  "số bước/vòng  = 200 × 16        = 3200 bước",
  "",
  "steps_per_mm  = 3200 / 40       = 80 bước cho mỗi milimét",
]));
P(p("Con số **80 bước/mm** sẽ xuất hiện khắp tài liệu này. Nó cũng cho biết độ phân giải nhỏ nhất của máy: 1/80 mm, tức 12.5 micromét."));

P(h2("1.5 Timer và ngắt: cách giữ nhịp chính xác"));
P(p("Phát xung bằng vòng lặp kèm hàm trễ thì không dùng được, vì khi đó CPU không làm được việc gì khác, và thời gian cũng không chính xác. Giải pháp là dùng **timer**, một bộ đếm chạy bằng phần cứng, độc lập với CPU."));
P(p("Cách hoạt động: nạp vào timer một con số, nó đếm tới đó rồi phát ra tín hiệu gọi là **ngắt**. CPU đang làm gì cũng tạm dừng, nhảy vào một hàm gọi là **trình phục vụ ngắt** (ISR), chạy xong thì quay lại chỗ cũ."));
P(p("Trong dự án này, TIM2 được cấu hình để một nhịp đếm bằng đúng 1 micro giây. Thanh ghi ARR giữ số nhịp giữa hai lần ngắt, nên **ARR chính là chu kỳ bước tính bằng micro giây**."));
P(...note("Quy tắc vàng về ISR:", "hàm ngắt phải cực ngắn. Không gọi hàm trễ, không in ra màn hình, không gửi UART, không dùng số thực nếu tránh được. Ở tốc độ cao, ISR chạy hàng chục nghìn lần mỗi giây; chậm một chút là cả hệ thống sụp."));

// ---- 2. CoreXY
P(new Paragraph({ children: [new PageBreak()] }));
P(h1("2. Động học CoreXY"));
P(p("Đây là phần lý thuyết quan trọng nhất của máy, và cũng là phần khiến CoreXY khác với máy in thông thường."));

P(h2("2.1 Vấn đề: không có motor X và motor Y"));
P(p("Máy in kiểu Cartesian thông thường có một motor lo trục X, một motor lo trục Y. Muốn đi theo X thì quay motor X, đơn giản."));
P(p("CoreXY thì cả hai motor đều **đứng yên trên khung**, không motor nào phải di chuyển theo đầu in. Nhờ vậy khối lượng chuyển động rất nhẹ, máy chạy nhanh được. Cái giá phải trả: **cả hai motor cùng tham gia vào mọi chuyển động**, thông qua hai vòng dây đai bắt chéo."));

P(h2("2.2 Công thức, và nó từ đâu ra"));
P(p("Nguyên lý duy nhất cần dùng: **dây đai không co giãn**. Nếu motor đứng yên, dây không trượt qua puly, nên chiều dài đoạn dây từ motor tới đầu in bị khoá cứng. Motor quay bao nhiêu milimét thì đoạn dây đó dài ra hoặc ngắn đi đúng bấy nhiêu."));
P(p("Đi theo đoạn dây của motor A: từ puly chạy dọc một cạnh (chiều dài phụ thuộc Y), rồi chạy dọc thanh ngang tới đầu in (chiều dài phụ thuộc X). Đai B đối xứng gương nên phần ngang của nó ngắn đi khi X tăng. Kết quả:"));
P(...code([
  "Động học ngược (muốn đầu in tới đâu thì motor quay bao nhiêu):",
  "    ΔA = ΔX + ΔY",
  "    ΔB = ΔX − ΔY",
  "",
  "Động học thuận (motor quay rồi thì đầu in đi đâu):",
  "    ΔX = (ΔA + ΔB) / 2",
  "    ΔY = (ΔA − ΔB) / 2",
]));
P(p("Dấu cộng trừ có thể đổi tuỳ cách đi dây và chiều quay. Bản chất không đổi: **một motor ứng với tổng X + Y, motor kia ứng với hiệu X − Y**."));

P(h2("2.3 Hệ quả cần nhớ"));
P(table(
  ["Đầu in đi", "Motor A", "Motor B", "Ghi chú"],
  [
    ["+X", "quay", "quay cùng chiều", "cả hai cùng kéo, lực mạnh"],
    ["+Y", "quay", "quay ngược chiều", "cả hai cùng kéo"],
    ["Chéo 45° ↗", "quay gấp đôi", "đứng yên", "chỉ một motor làm việc"],
    ["Chéo 45° ↘", "đứng yên", "quay gấp đôi", "chỉ một motor làm việc"],
  ],
  [1.1, 1.3, 1.5, 2.2]
));
P(gap());
P(p("Điều quan trọng nhất rút ra: khi đi chéo, motor phải quay nhanh hơn đầu in **căn bậc hai của 2, tức khoảng 1.41 lần**. Vì vậy mọi giới hạn tốc độ và gia tốc phải đặt cho **từng motor**, không đặt cho đầu in."));
P(p("Cách hình dung dễ nhất: CoreXY là một máy Cartesian **bị xoay 45 độ**. Motor A điều khiển trục chéo một hướng, motor B điều khiển trục chéo hướng kia."));

// ---- 3. Kiến trúc
P(new Paragraph({ children: [new PageBreak()] }));
P(h1("3. Kiến trúc firmware"));
P(p("Trước khi viết dòng code nào, cần quyết định chia phần mềm thành những lớp nào. Chia đúng thì mỗi lớp chỉ cần biết một việc, và sửa một lớp không làm hỏng lớp khác."));
P(...code([
  "   Lệnh G-code từ máy tính",
  "            │",
  "   ┌────────▼─────────┐",
  "   │ gcode.c          │  đọc chữ, hiểu G1 X10 Y20 F6000",
  "   ├──────────────────┤",
  "   │ motion_control.c │  giữ vị trí tuyệt đối, chia cung tròn",
  "   ├──────────────────┤  thành các đoạn thẳng",
  "   │ stepper.c        │  planner: hàng đợi, tốc độ, lookahead",
  "   │  (phần planner)  │",
  "   ├──────────────────┤",
  "   │ stepper.c        │  ISR: Bresenham, profile tốc độ,",
  "   │  (phần ISR)      │  phát xung STEP/DIR",
  "   └────────┬─────────┘",
  "            ▼",
  "        TMC2209 × 2",
]));
P(p("Ranh giới quan trọng nhất nằm giữa planner và ISR:"));
P(table(
  ["Lớp", "Chạy ở đâu", "Đơn vị", "Kiểu số", "Được phép chậm không"],
  [
    ["G-code, motion_control", "vòng lặp chính", "mm", "số thực", "được"],
    ["Planner", "vòng lặp chính", "mm, mm/s", "số thực", "được"],
    ["ISR", "ngắt timer", "nhịp, micro giây", "số nguyên", "tuyệt đối không"],
  ],
  [2.2, 1.4, 1.3, 1.1, 1.6]
));
P(gap());
P(p("Mọi phép tính nặng, mọi phép căn bậc hai, mọi số thực đều bị đẩy lên vòng lặp chính. ISR chỉ còn cộng, trừ, chia số nguyên."));

// ---- 4. Bước 0
P(new Paragraph({ children: [new PageBreak()] }));
P(h1("4. Bước 0: cấu hình driver TMC2209 qua UART"));
P(h2("4.1 Vì sao phải có bước này"));
P(p("TMC2209 có hai chân MS1 và MS2 dùng để chọn vi bước. Nhưng trong thiết kế này, hai chân đó đã bị dùng vào việc khác: **đặt địa chỉ UART** cho driver, vì hai driver dùng chung một đường dây."));
P(p("Hậu quả: nếu không cấu hình gì, driver A chạy 1/8 vi bước còn driver B chạy 1/32, lệch nhau 4 lần. Với CoreXY thì vẽ hình vuông sẽ ra hình méo. **Bắt buộc phải cài vi bước qua UART.**"));

P(h2("4.2 Giao thức UART một dây"));
P(p("Chân PDN_UART của driver vừa nhận vừa gửi trên cùng một sợi dây. Vi điều khiển nối TX qua điện trở 1k rồi chung với RX vào sợi đó."));
P(...code([
  "PB10 (TX) ──[1k]──┬── PDN_UART driver A (địa chỉ 0)",
  "                  ├── PDN_UART driver B (địa chỉ 1)",
  "PB11 (RX) ────────┘",
]));
P(...note("Hệ quả quan trọng:", "mọi byte gửi đi đều **vọng ngược lại** chân RX. Khi đọc một thanh ghi, firmware nhận về 12 byte: 4 byte vọng của chính mình, rồi 8 byte trả lời của driver. Phải bỏ 4 byte đầu."));
P(p("Gói tin đọc thanh ghi gồm 4 byte: đồng bộ 0x05, địa chỉ driver, mã thanh ghi, và CRC. Gói trả lời gồm 8 byte: 0x05, 0xFF, mã thanh ghi, 4 byte dữ liệu theo thứ tự byte cao trước, và CRC."));

P(h2("4.3 Các thanh ghi đã cài"));
P(table(
  ["Thanh ghi", "Giá trị", "Mục đích"],
  [
    ["NODECONF", "SENDDELAY = 2", "driver chờ lâu hơn trước khi trả lời, cần khi nhiều driver chung bus"],
    ["GCONF", "0x1C1", "pdn_disable và mstep_reg_select, để lấy vi bước từ thanh ghi thay vì từ chân MS"],
    ["CHOPCONF", "MRES = 4, intpol = 1", "1/16 vi bước, có nội suy lên 1/256"],
    ["GSTAT", "ghi 0x7", "xoá cờ reset, drv_err, uv_cp"],
    ["IFCNT", "chỉ đọc", "bộ đếm số lệnh ghi thành công, dùng để xác nhận"],
  ],
  [1.3, 1.3, 3.4]
));
P(gap());
P(...note("Mẹo kiểm tra:", "thanh ghi IOIN có 8 bit cao là mã phiên bản, luôn bằng 0x21 với TMC2209. Đọc được đúng 0x21 là biết chắc đang nói chuyện với đúng chip, dây và CRC đều ổn."));

P(h2("4.4 Bốn lỗi đã gặp ở bước này"));
P(p("Bước này mất nhiều thời gian nhất cả dự án, và không lỗi nào nằm ở thuật toán:"));
P(num("**Pad UART trên module chưa hàn.** Nhiều module StepStick để hở chân PDN_UART, phải hàn một mối nối thì chân đó mới thông ra ngoài. Triệu chứng: tiếng vọng vẫn đủ, driver im lặng tuyệt đối."));
P(num("**Điện trở 10k thay vì 1k.** Sườn tín hiệu lên quá chậm, byte trả lời của driver bị lấy mẫu sai, nhận về rác kiểu 0x50 thay vì 0x05."));
P(num("**Timeout để cứng 5 mili giây** trong khi baud là 9600. Gửi 8 byte ở 9600 baud mất 8.3 mili giây, tức timeout trước cả khi gửi xong. Đã sửa thành tự tính theo baud."));
P(num("**Không có khoảng nghỉ giữa hai gói.** Datasheet ghi rõ driver còn giữ đường dây thêm 4 bit sau khi trả lời xong. Gửi gói kế tiếp ngay lập tức làm hai bên cùng lái bus, byte nhận về bị lệch bit."));
P(p("Bài học chung: khi giao tiếp không chạy, **đừng sửa thuật toán trước**. Hãy đo xem tín hiệu có tới nơi không, và đếm xem nhận được bao nhiêu byte. Biến debug ghi lại từng byte của lần giao tiếp cuối cùng là thứ giúp tìm ra cả bốn lỗi trên."));

// ---- 5. Bước 1
P(new Paragraph({ children: [new PageBreak()] }));
P(h1("5. Bước 1: một động cơ quay bằng timer"));
P(p("Mục tiêu nhỏ và rõ: một động cơ quay đúng số bước yêu cầu, xung do ngắt timer phát ra, và CPU vẫn rảnh để làm việc khác."));

P(h2("5.1 Cấu hình timer"));
P(table(
  ["Thông số", "Giá trị", "Vì sao"],
  [
    ["Timer", "TIM2", "loại 32 bit, đặt chu kỳ dài thoải mái khi chạy chậm"],
    ["Clock vào", "240 MHz", "clock timer của nhánh APB1"],
    ["Prescaler", "239", "240 MHz chia 240 bằng 1 MHz, tức một nhịp là 1 micro giây"],
    ["ARR", "chu kỳ bước", "vì nhịp là 1 micro giây nên ARR đọc thẳng ra micro giây"],
  ],
  [1.2, 1.2, 3.6]
));
P(gap());

P(h2("5.2 Cấu trúc code"));
P(...code([
  "stepper_move_a(steps, speed):     // chạy ở vòng lặp chính",
  "    đặt chân DIR theo dấu của steps",
  "    nạp steps_remaining",
  "    ARR = 1000000 / speed",
  "    bật timer kèm ngắt",
  "",
  "ISR:                              // mỗi lần ngắt là một bước",
  "    bật chân STEP",
  "    chờ 2 micro giây",
  "    hạ chân STEP",
  "    position += chiều; steps_remaining--",
  "    nếu hết thì tắt timer",
]));

P(h2("5.3 Phép thử"));
P(bullet("Chạy 1600 bước ở 1600 bước mỗi giây, tức 20 mm ở 20 mm/s. Động cơ phải quay rồi dừng đúng lúc."));
P(bullet("Biến vị trí phải đúng bằng 1600 sau khi chạy."));
P(bullet("Đi rồi về, vạch dấu trên puly phải trở lại đúng chỗ cũ."));
P(bullet("**Quan trọng nhất**: LED nháy trong SysTick vẫn phải nháy đều trong lúc động cơ quay. Đó là bằng chứng CPU không bị chặn."));

// ---- 6. Bước 2
P(new Paragraph({ children: [new PageBreak()] }));
P(h1("6. Bước 2: hai động cơ và thuật toán Bresenham"));
P(h2("6.1 Vấn đề đồng bộ"));
P(p("Đi một đoạn thẳng bất kỳ, hai motor thường phải đi **số bước khác nhau**. Ví dụ ΔA = 1000 bước còn ΔB = 300 bước. Hai motor phải cùng khởi hành và cùng về đích, nếu không quỹ đạo sẽ cong."));
P(p("Cách sai: cho mỗi motor một timer riêng. Hai timer không bao giờ đồng bộ hoàn hảo."));
P(p("Cách đúng: **một timer duy nhất cho cả hai**. Mỗi lần ngắt gọi là một **nhịp**. Motor đi nhiều bước hơn thì bước ở mọi nhịp, motor kia thỉnh thoảng mới bước."));

P(h2("6.2 Bresenham"));
P(p("Đây là thuật toán vốn dùng để vẽ đường thẳng trên màn hình pixel, và bài toán ở đây giống hệt: phân bố 300 bước đều trong 1000 nhịp, chỉ dùng số nguyên."));
P(...code([
  "n = max(|ΔA|, |ΔB|)        số nhịp của cả đoạn",
  "err_a = err_b = n / 2      khởi tạo ở giữa cho phân bố đều",
  "",
  "mỗi nhịp:",
  "    err_a += |ΔA|",
  "    nếu err_a >= n:  A bước,  err_a -= n",
  "    err_b += |ΔB|",
  "    nếu err_b >= n:  B bước,  err_b -= n",
]));
P(p("Triết lý của Bresenham: **không vứt phần dư, giữ lại dùng tiếp**. Biến err tích luỹ phần lẻ cho tới khi đủ một bước. Cùng ý tưởng này sẽ xuất hiện lại ở phần gia tốc."));

P(h2("6.3 Hai chi tiết dễ sai"));
P(num("**Chiều dài đoạn phải tính trong XY**, không tính trong không gian AB. Nếu lấy nhầm, tốc độ đầu in sẽ sai đúng hệ số 1.41 ở các hướng chéo."));
P(num("**Số bước phải tính từ toạ độ đích tuyệt đối**, không cộng dồn từng đoạn đã làm tròn. Nếu cộng dồn, sai số làm tròn tích lại sau hàng nghìn đoạn."));
P(...code([
  "// Đúng",
  "target_a = lroundf((x_đích + y_đích) * 80);",
  "steps_a  = target_a - pos_a;",
  "",
  "// Sai: sai số tích luỹ dần",
  "steps_a = lroundf((dx + dy) * 80);",
]));

P(h2("6.4 Bỏ vòng chờ trong ngắt"));
P(p("Phiên bản đầu bật chân STEP, chờ 2 micro giây bằng vòng lặp rỗng, rồi hạ xuống. Chờ trong ngắt là lãng phí: CPU đứng im mà vẫn tính là bận."));
P(p("Cách làm đúng là dùng **kênh so sánh** của timer. Timer tự hạ chân xuống sau đúng 2 micro giây, bằng phần cứng:"));
P(...code([
  "        ngắt update (ARR)            ngắt compare (CC1)",
  "              │                            │",
  " STEP ────────┘‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾└──────────",
  "              │◄────── 2 micro giây ──────►│",
  "        Bresenham,                     hạ hai chân",
  "        nâng chân STEP",
]));
P(table(
  ["Phiên bản", "Thời gian CPU cho mỗi bước", "Trần tốc độ mỗi motor"],
  [["Có vòng chờ", "khoảng 5 micro giây", "100 kHz"], ["Dùng kênh compare", "khoảng 1 micro giây", "200 kHz"]],
  [1.4, 2.2, 2]
));
P(gap());
P(...note("Chi tiết dễ bỏ sót:", "nếu tắt timer ngay khi hết bước thì ngắt compare không bao giờ tới và chân STEP kẹt ở mức cao. Cần một cờ: ngắt update chỉ đánh dấu, ngắt compare hạ chân xong mới thật sự tắt timer."));

// ---- 7. Bước 3
P(new Paragraph({ children: [new PageBreak()] }));
P(h1("7. Bước 3: gia tốc hình thang"));
P(h2("7.1 Vì sao cần"));
P(p("Rotor và puly có quán tính. Ra lệnh chạy 150 mm/s ngay từ bước đầu tiên, từ trạng thái đứng yên, thì mômen không đủ, động cơ rung tại chỗ và mất toàn bộ số bước."));
P(p("Trước khi có bước này, máy chỉ chạy được khoảng 30 tới 50 mm/s. Giới hạn đó gọi là **pull-in rate**: tốc độ cao nhất mà động cơ khởi động tức thời còn bám được."));

P(h2("7.2 Hình dạng cần tạo"));
P(...code([
  " tốc độ",
  "   │        ┌──────────────┐",
  "   │       ╱                ╲",
  "   │      ╱                  ╲",
  "   └─────┴────────────────────┴──→ quãng đường",
  "     tăng tốc   chạy đều   giảm tốc",
]));
P(p("Chỉ cần hai công thức vật lý phổ thông:"));
P(...code([
  "v = a · t                    tốc độ sau thời gian t",
  "s = v² / (2a)                quãng đường cần để đạt tốc độ v",
  "",
  "Ví dụ thật: 150 mm/s với gia tốc 2000 mm/s²",
  "    thời gian tăng tốc = 150 / 2000      = 0.075 giây",
  "    quãng tăng tốc     = 150² / (2·2000) = 5.6 mm",
]));
P(p("Vậy hành trình 100 mm chia thành 5.6 mm tăng tốc, 88.8 mm chạy đều, 5.6 mm giảm tốc."));

P(h2("7.3 Đổi sang không gian nhịp"));
P(p("ISR không biết milimét, cũng không biết giây. Nó chỉ biết nhịp và micro giây. Cần một tỉ số quy đổi, và nó có sẵn trong mỗi lệnh chạy:"));
P(...code([
  "ticks_per_mm = n / length_mm",
  "",
  "    n          số nhịp của đoạn, bằng max(|ΔA|, |ΔB|)",
  "    length_mm  quãng đường đầu in đi trong XY",
]));
P(p("Điều thú vị: hệ số 1.41 của đường chéo **tự hiện ra** mà không ai viết nó vào code. Lý do: n đi qua phép biến đổi CoreXY nên mang theo đặc tính hình học của cơ cấu, còn length_mm thì không."));
P(table(
  ["Lệnh chạy", "ΔA", "ΔB", "n", "length", "ticks_per_mm"],
  [
    ["Thẳng 3 mm theo X", "240", "240", "240", "3 mm", "80"],
    ["Chéo 45°, cũng 3 mm", "339", "0", "339", "3 mm", "113"],
  ],
  [2.2, 0.9, 0.9, 0.9, 1.1, 1.6]
));
P(gap());
P(p("Cùng 3 mm nhưng một bên cần 240 nhịp, bên kia cần 339 nhịp. Tỉ số 339/240 chính là 1.41."));

P(h2("7.4 Công thức truy hồi AVR446"));
P(p("Chu kỳ chính xác của bước thứ n đòi hỏi căn bậc hai, không thể chạy trong ISR hàng chục nghìn lần mỗi giây. Thuật toán của Atmel AVR446 biến nó thành phép trừ:"));
P(...code([
  "tăng tốc:  c = c − (2c + rest) / (4·i + 1)",
  "giảm tốc:  c = c + (2c + rest) / (4·j + 1)",
  "chạy đều:  c = c_min",
  "",
  "rồi ghi:   ARR = c − 1",
]));
P(p("Căn bậc hai chỉ còn ở bước đầu tiên, c0 bằng F nhân căn của 2/a, và nó chạy **một lần cho cả lệnh chạy**, ở vòng lặp chính."));
P(p("Bảng dưới là số thật, chạy bằng chính phép toán số nguyên trong ISR, cho lệnh chạy 100 mm ở 150 mm/s:"));
P(table(
  ["Bước", "Chu kỳ c", "Tốc độ tương ứng"],
  [
    ["0", "2000 micro giây", "6.2 mm/s"],
    ["1", "1200", "10.4 mm/s"],
    ["2", "934", "13.4 mm/s"],
    ["5", "631", "19.8 mm/s"],
    ["11", "437", "28.6 mm/s"],
    ["450", "83", "150.6 mm/s"],
  ],
  [1, 1.6, 1.8]
));
P(gap());
P(p("Chú ý lúc đầu giảm rất mạnh rồi chậm dần, vì tốc độ tăng theo căn bậc hai của quãng đường."));

P(h2("7.5 Biến rest và vì sao thiếu nó là hỏng hẳn"));
P(p("Phép chia trong C là chia số nguyên, luôn cắt bỏ phần lẻ. Ở đây mất phần lẻ không phải là sai số nhỏ, mà là hỏng hẳn. Ví dụ khi đang ở nhịp 400 với c bằng 90:"));
P(...code([
  "num = 2 × 90 = 180        den = 4 × 400 + 1 = 1601",
  "180 / 1601 = 0            phần nguyên bằng 0!",
  "",
  "Không có rest:  c đứng im ở 90 mãi mãi, đường dốc khựng lại,",
  "                động cơ không bao giờ đạt tốc độ đặt.",
  "",
  "Có rest:        phần lẻ được cộng dồn, cứ khoảng 9 nhịp thì",
  "                c giảm được 1 micro giây.",
]));
P(...code([
  "uint32_t num = 2U * c + rest;   // cộng phần để dành từ lần trước",
  "c  -= num / den;                 // lấy phần nguyên",
  "rest = num % den;                // cất phần lẻ lại cho lần sau",
]));

P(h2("7.6 Khi đoạn quá ngắn: profile tam giác"));
P(p("Nếu quãng tăng tốc cộng quãng giảm tốc vượt quá chiều dài đoạn, máy không bao giờ kịp đạt tốc độ đặt. Khi đó phải tìm điểm hai dốc gặp nhau và profile trở thành hình tam giác."));
P(p("Đây là lý do thực tế khiến in chi tiết nhỏ luôn chậm hơn tốc độ đặt trong slicer. Đo trên máy này: đoạn 2 mm đặt 150 mm/s chỉ đạt đỉnh **75 mm/s**. Không phải máy yếu, mà là quãng đường quá ngắn."));

P(h2("7.7 Một chi tiết phần cứng dễ bỏ sót"));
P(...note("ARR có preload:", "ghi ARR giữa chừng thì giá trị mới chỉ áp dụng từ chu kỳ sau. Điều này **đúng ý** khi đang chạy đường dốc, nhưng lúc bắt đầu một lệnh chạy mới thì phải ép nạp ngay bằng lệnh tạo sự kiện update, nếu không chu kỳ đầu tiên sẽ dùng giá trị của lệnh trước."));

// ---- 8. Bước 5 lookahead
P(new Paragraph({ children: [new PageBreak()] }));
P(h1("8. Bước 5: hàng đợi và lookahead"));
P(h2("8.1 Vấn đề"));
P(p("Sau bước 3, mỗi lệnh chạy đều bắt đầu từ 0 và kết thúc về 0. Một đường tròn chia thành 72 dây cung sẽ dừng 72 lần. Máy giật và chậm gấp ba lần cần thiết."));
P(p("Nhưng không thể cứ thế chạy thẳng qua mọi điểm nối: ở một góc vuông mà vẫn giữ nguyên tốc độ thì sẽ có một cú giật rất mạnh, đủ làm mất bước và rung cả khung máy."));
P(p("Vậy câu hỏi thật sự là: **mỗi điểm nối được phép đi qua ở tốc độ nào?**"));

P(h2("8.2 Junction deviation"));
P(p("Mô hình của grbl: tưởng tượng đầu in đi qua góc theo một cung tròn nhỏ. Góc càng nhọn thì bán kính cung càng nhỏ, mà bán kính nhỏ thì lực hướng tâm lớn, nên tốc độ phải giảm."));
P(p("Tham số điều chỉnh gọi là junction deviation, đơn vị milimét, mặc định 0.05 trong dự án này. Nó là mức sai lệch cho phép so với góc nhọn lý tưởng. Đặt lớn thì qua góc nhanh hơn nhưng góc bị bo tròn nhiều hơn."));
P(table(
  ["Góc giữa hai đoạn", "Tốc độ được phép đi qua"],
  [
    ["Gần như thẳng", "giữ nguyên tốc độ"],
    ["Góc vuông 90 độ", "khoảng 15 mm/s với thông số hiện tại"],
    ["Gập ngược 180 độ", "0, bắt buộc dừng"],
  ],
  [1.6, 2.4]
));

P(h2("8.3 Hai lượt quét"));
P(p("Biết tốc độ cho phép ở từng góc vẫn chưa đủ. Còn phải bảo đảm tính khả thi về mặt vật lý: không thể vào một đoạn 1 mm ở tốc độ 150 mm/s rồi đòi dừng hẳn ở cuối đoạn đó."));
P(p("Mỗi khi có đoạn mới được xếp hàng, planner quét hai lượt trên toàn bộ hàng đợi:"));
P(num("**Lượt lùi**, đi từ đoạn cuối về đầu: một đoạn không được vào nhanh hơn mức mà nó còn **phanh kịp** để khớp tốc độ vào của đoạn ngay sau."));
P(num("**Lượt tới**, đi từ đầu về cuối: cũng không được vào nhanh hơn mức mà đoạn trước **đẩy lên được**."));
P(p("Đoạn mà ISR đang chạy không bao giờ bị sửa, vì đường dốc của nó đã khởi động rồi."));

P(h2("8.4 Nối liền hai đoạn trong ISR"));
P(p("Khi một đoạn kết thúc, ISR nạp luôn đoạn kế tiếp mà **không tắt timer**. Nhưng công thức AVR446 vốn giả định xuất phát từ đứng yên, trong khi ở đây đoạn mới bắt đầu ở một tốc độ khác 0."));
P(p("Giải pháp: đặt tốc độ vào và tốc độ ra lên đúng vị trí trên một **đường dốc ảo xuất phát từ 0**, bằng hai số bù i_offset và j_offset. Nhờ vậy công thức truy hồi chạy tiếp liền mạch thay vì khởi động lại."));

P(h2("8.5 Kết quả đo trên máy thật"));
P(table(
  ["Cách gửi lệnh", "Thời gian", "Ghi chú"],
  [
    ["Một đoạn 100 mm", "728 ms", "mốc tham chiếu"],
    ["Hai mươi đoạn 5 mm", "728 ms", "chia nhỏ không tốn thêm gì"],
    ["Hai mươi đoạn, nếu dừng ở mỗi điểm nối", "1633 ms", "theo mô phỏng"],
    ["Đường tròn 72 dây cung", "nhanh hơn 3.6 lần", "theo mô phỏng"],
  ],
  [2.4, 1.1, 1.8]
));
P(gap());
P(p("Hai con số đầu bằng nhau tuyệt đối. Đây là kết quả quan trọng nhất của cả dự án, vì phần mềm cắt lớp luôn sinh ra hàng nghìn đoạn ngắn."));

// ---- 9. Bước 4 G-code
P(new Paragraph({ children: [new PageBreak()] }));
P(h1("9. Bước 4: đọc lệnh G-code"));
P(h2("9.1 G-code là gì"));
P(p("Một ngôn ngữ rất đơn giản: mỗi dòng là một lệnh, gồm các chữ cái kèm số."));
P(...code([
  "G1 X30 Y20 F6000      đi thẳng tới toạ độ (30, 20) với tốc độ 6000 mm/phút",
  "G0 X0 Y0              di chuyển nhanh, không in",
  "G2 X30 Y0 I-15 J0     đi theo cung tròn thuận chiều kim đồng hồ",
  "G90 / G91             toạ độ tuyệt đối / tương đối",
  "G92 X0 Y0             đặt điểm hiện tại làm gốc, không di chuyển",
]));
P(...note("Đơn vị:", "G-code dùng mm cho mỗi phút, firmware dùng mm cho mỗi giây. Parser phải chia cho 60. Quên chi tiết này là máy chạy nhanh gấp 60 lần."));

P(h2("9.2 Vì sao cần lớp motion_control riêng"));
P(p("Mọi hình đều quy về đoạn thẳng. Hình vuông là 4 đoạn, đường tròn là 72 đoạn. Bộ phát xung **không hề biết** nó đang vẽ hình gì."));
P(p("Lớp motion_control giữ vị trí tuyệt đối và làm việc chia cung tròn thành dây cung. Số đoạn tính theo dung sai:"));
P(...code([
  "sai lệch dây cung ≈ r · θ² / 8     →     θ = căn(8 · dung_sai / r)",
  "",
  "dung sai dùng trong dự án: 0.002 mm, giống grbl",
  "cung bán kính lớn tự được chia mịn hơn",
]));
P(p("Nhờ tách lớp như vậy, khi thêm hỗ trợ cung tròn G2 và G3, file stepper.c **không phải sửa một dòng nào**."));

P(h2("9.3 Bỏ qua thay vì báo lỗi"));
P(p("Parser chấp nhận và bỏ qua Z, E, M, S, T, N. Máy hiện chỉ có XY, nhưng file của slicer thật luôn có lệnh cho trục Z và đầu đùn. Bỏ qua thay vì báo lỗi giúp chạy thử được file thật ngay."));

P(h2("9.4 Kết quả chạy thật"));
P(p("File demo gồm hình vuông, ngôi sao năm cánh góc nhọn, một đường tròn bằng một lệnh G2 duy nhất, hình chữ nhật bo góc bằng bốn cung G3, và một zigzag hai mươi đoạn ngắn."));
P(table(
  ["Chỉ số", "Giá trị"],
  [
    ["Số dòng G-code", "48"],
    ["Số lỗi cú pháp", "0"],
    ["Số đoạn thẳng sau khi chia cung", "355"],
    ["Tổng quãng đường", "799 mm"],
    ["Thời gian chạy", "9.4 giây"],
    ["Vị trí sau khi chạy xong", "đúng gốc, bộ đếm hai motor về 0"],
  ],
  [2.2, 1.8]
));

// ---- 10. USB CDC
P(new Paragraph({ children: [new PageBreak()] }));
P(h1("10. Nhận lệnh qua USB"));
P(h2("10.1 Giao thức"));
P(p("Máy tính gửi từng dòng G-code, bo trả lời ok hoặc error. Ngoài ra có bốn ký tự được xử lý **ngay lập tức trong ngắt USB**, không xếp hàng:"));
P(table(
  ["Ký tự", "Tác dụng"],
  [
    ["?", "báo trạng thái: đang chạy hay rảnh, toạ độ, số chỗ trống trong hàng đợi"],
    ["!", "dừng khẩn: xoá hàng đợi và tắt timer ngay"],
    ["~", "bỏ trạng thái dừng khẩn, chạy tiếp"],
    ["Ctrl-X", "reset mềm"],
  ],
  [1, 4]
));
P(gap());
P(...note("Sau khi dừng khẩn:", "phải kéo vị trí mà planner đang tin về đúng vị trí thật của động cơ. Nếu không, lệnh tiếp theo sẽ tính từ một toạ độ sai."));

P(h2("10.2 Vì sao không chờ ok từng dòng"));
P(p("Cách đơn giản nhất là gửi một dòng, chờ ok, rồi gửi dòng tiếp. Nhưng làm vậy thì hàng đợi của planner **rỗng liên tục**, và lookahead không còn gì để nhìn trước. Công sức của bước 5 mất sạch."));
P(p("Cách đúng, giống các script gửi file của grbl: **đếm ký tự**. Máy tính biết bộ đệm nhận của bo lớn bao nhiêu, và cứ gửi tiếp chừng nào còn chỗ, giữ cho hàng đợi luôn đầy."));

P(h2("10.3 Trạng thái hiện tại"));
P(p("Phía vi điều khiển đã kiểm tra xong và đều đúng: clock USB 48 MHz lấy từ PLL1Q, nguồn 3.3V cho USB sẵn sàng, ngắt đã bật, hàm nhận đã nối vào parser. Máy tính nhìn thấy có thiết bị cắm vào nhưng chưa đọc được mô tả thiết bị, lỗi -71, nên nghi vấn còn lại nằm ở đường dây D+ và D−."));

// ---- 11. Công cụ
P(new Paragraph({ children: [new PageBreak()] }));
P(h1("11. Công cụ và cách làm việc"));
P(h2("11.1 Mô phỏng trước khi chạy máy"));
P(p("Thói quen đáng giá nhất trong cả dự án: **viết lại thuật toán bằng Python rồi chạy thử trên máy tính trước khi nạp xuống bo**, dùng đúng phép toán số nguyên như trong ISR."));
P(p("Nhờ vậy, profile gia tốc và lookahead đều được kiểm chứng trước khi động cơ quay. Khi chạy thật, số đo khớp với mô phỏng tới từng mili giây: 725 ms so với 728 ms."));
P(p("Ngoài ra còn giúp trả lời nhanh các câu hỏi thiết kế, ví dụ đoạn 2 mm ở 150 mm/s thì thực tế đạt bao nhiêu, mà không cần nạp lại firmware."));

P(h2("11.2 Biến debug và live watch"));
P(p("Trong lúc tìm lỗi UART, một biến toàn cục ghi lại toàn bộ lần giao tiếp cuối cùng đã giúp phân biệt rõ ràng ba trường hợp:"));
P(table(
  ["Số byte nhận được", "Kết luận"],
  [
    ["0 byte", "không có cả tiếng vọng, lỗi dây hoặc cấu hình chân"],
    ["4 byte, đúng bằng gói gửi", "tiếng vọng tốt, driver im lặng, lỗi nguồn hoặc chân PDN"],
    ["12 byte nhưng sai nội dung", "tín hiệu méo, lỗi mức điện áp hoặc điện trở"],
  ],
  [1.4, 3.2]
));
P(gap());
P(p("Bài học: **biến debug phải phân biệt được các giả thuyết khác nhau**, không chỉ báo thành công hay thất bại."));

P(h2("11.3 Nạp và chạy bằng một lệnh"));
P(p("Script tools/flash_run.sh đọc địa chỉ biến từ file elf bằng nm, nạp firmware, chờ chip khởi động xong rồi ghi thẳng vào RAM để kích hoạt phép thử, sau đó ngắt kết nối."));
P(p("Ba chi tiết khiến nó hoạt động được:"));
P(bullet("Phải **chờ sau khi reset** rồi mới ghi, vì vùng nhớ dữ liệu bị khởi tạo lại lúc chip khởi động."));
P(bullet("Dùng lệnh ghi **một byte** cho biến một byte, nếu ghi cả bốn byte sẽ đè lên biến kế bên."));
P(bullet("Đọc địa chỉ từ file elf mỗi lần, vì địa chỉ đổi sau mỗi lần biên dịch."));

P(h2("11.4 Quy trình chung cho mỗi bước"));
P(num("Viết thuật toán, mô phỏng bằng Python, kiểm tra kết quả hợp lý."));
P(num("Viết firmware, biên dịch không còn cảnh báo."));
P(num("Nạp và chạy một phép thử nhỏ nhất có thể."));
P(num("Đọc biến debug, đối chiếu với mô phỏng."));
P(num("Chỉ khi khớp mới commit và chuyển sang bước sau."));

// ---- 12. Bài học
P(new Paragraph({ children: [new PageBreak()] }));
P(h1("12. Tổng hợp các lỗi đã gặp"));
P(p("Bảng này đáng giá hơn phần lý thuyết, vì đây là những thứ không có trong sách."));
P(table(
  ["Hiện tượng", "Nguyên nhân thật sự", "Bài học"],
  [
    ["Driver không trả lời UART", "pad UART trên module chưa hàn", "tiếng vọng không chứng minh dây đã tới driver"],
    ["Byte nhận về bị lệch bit", "điện trở 10k làm sườn tín hiệu chậm", "dùng đúng giá trị nhà sản xuất khuyến nghị"],
    ["Gửi gói thất bại", "timeout cứng 5 ms, baud 9600", "mọi thời hạn phải tính theo tham số đang dùng"],
    ["Gói thứ hai trở đi ra rác", "driver giữ bus thêm 4 bit sau khi trả lời", "đọc kỹ phần định thời trong datasheet"],
    ["Motor không quay dù báo thành công", "đặt tốc độ 2000 mm/s, động cơ rung tại chỗ", "giới hạn phải đặt theo khả năng vật lý, không chỉ theo giới hạn CPU"],
    ["Đứt kết nối nạp khi chạy nhanh", "nhiễu từ động cơ vào dây SWD", "dây debug phải ngắn và xoắn với dây mát"],
    ["Mất bước ở tốc độ cao", "chưa có gia tốc", "pull-in rate là giới hạn thật của động cơ"],
    ["Chu kỳ đầu tiên sai", "ARR có preload", "đọc kỹ cơ chế preload của timer"],
  ],
  [1.8, 2.2, 2.6]
));
P(gap());
P(h2("12.1 Ba nguyên tắc rút ra"));
P(num("**Khi có lỗi, đo trước khi sửa code.** Bốn lỗi UART đầu tiên đều ở phần cứng hoặc tham số, không có lỗi nào ở thuật toán."));
P(num("**Mỗi lớp chỉ nói một thứ tiếng.** Lớp trên dùng mm và số thực, lớp dưới dùng nhịp và số nguyên, và chỉ có đúng một chỗ làm phiên dịch."));
P(num("**Có số đo cũ thì sửa code mới an toàn.** Khi dọn dẹp hai biến đếm thành một, chạy lại hai phép thử cũ và thấy vẫn đúng 728 ms là biết ngay không làm hỏng gì."));

// ---- 13. Phụ lục
P(new Paragraph({ children: [new PageBreak()] }));
P(h1("13. Phụ lục"));
P(h2("13.1 Thông số của máy"));
P(table(
  ["Thông số", "Giá trị"],
  [
    ["Vi điều khiển", "STM32H743IIT6, 480 MHz, bo lõi FK743M2"],
    ["Driver X và Y", "2 × TMC2209, điều khiển qua UART một dây"],
    ["Dây đai và puly", "GT2, 20 răng, 40 mm mỗi vòng"],
    ["Vi bước", "1/16, có nội suy lên 1/256"],
    ["steps_per_mm", "80"],
    ["Timer phát xung", "TIM2, một nhịp bằng 1 micro giây"],
    ["Độ rộng xung STEP", "2 micro giây, do kênh compare tạo ra"],
    ["Trần tốc độ mỗi motor", "40 kHz, tức 500 mm/s khi đi thẳng"],
    ["Gia tốc mặc định", "2000 mm/s²"],
    ["Junction deviation", "0.05 mm"],
    ["Độ sâu hàng đợi", "32 block"],
  ],
  [1.6, 2.8]
));
P(gap());

P(h2("13.2 Các công thức cần nhớ"));
P(...code([
  "Động học CoreXY     ΔA = ΔX + ΔY        ΔB = ΔX − ΔY",
  "                    ΔX = (ΔA+ΔB)/2      ΔY = (ΔA−ΔB)/2",
  "",
  "Số nhịp của đoạn    n = max(|ΔA|, |ΔB|)",
  "Quy đổi đơn vị      ticks_per_mm = n / length_mm",
  "",
  "Quãng tăng tốc      s = v² / (2a)",
  "Bước đầu tiên       c0 = F · căn(2/a)",
  "Truy hồi AVR446     c = c − 2c / (4i + 1)",
  "",
  "Chia cung tròn      θ = căn(8 · dung_sai / r)",
  "Tốc độ khả thi      v = căn(v_trước² + 2·a·s)",
]));

P(h2("13.3 Nên đọc gì tiếp"));
P(bullet("**grbl**, đọc trước tiên vì nhỏ và sáng sủa: planner.c cho phần lookahead, stepper.c cho phần phát xung, motion_control.c cho phần chia cung tròn."));
P(bullet("**grblHAL**, bản grbl viết lại có lớp HAL, có driver cho STM32H7, hữu ích khi cần tách phần phụ thuộc phần cứng."));
P(bullet("**Marlin**, phức tạp hơn nhiều, dùng để đối chiếu: planner.cpp và stepper.cpp."));
P(bullet("**Klipper**, cách tiếp cận khác hẳn, tính toán trên máy tính Linux còn vi điều khiển chỉ phát xung theo lịch."));
P(bullet("**Atmel AVR446**, tài liệu gốc của thuật toán gia tốc, và bài báo của David Austin năm 2005."));

P(h2("13.4 Việc còn lại"));
P(table(
  ["Hạng mục", "Trạng thái"],
  [
    ["Cấu hình TMC2209 qua UART", "xong, đã chạy thật"],
    ["Phát xung hai motor, động học CoreXY", "xong"],
    ["Gia tốc hình thang", "xong"],
    ["Hàng đợi và lookahead", "xong"],
    ["Parser G-code và chia cung tròn", "xong"],
    ["Nhận lệnh qua USB", "firmware xong, còn vướng đường dây USB"],
    ["Homing bằng cảm biến tiệm cận", "chưa làm"],
    ["Trục Z và đầu đùn", "chưa làm"],
    ["Đọc nhiệt độ và điều khiển PID", "chưa làm"],
    ["Input shaping", "chưa làm"],
    ["Vẽ mạch in", "chưa làm"],
  ],
  [2.4, 1.6]
));

// ---------- document ----------
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: convertInchesToTwip(0.3), hanging: convertInchesToTwip(0.18) } } } }],
      },
      {
        reference: "steps",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: convertInchesToTwip(0.32), hanging: convertInchesToTwip(0.2) } } } }],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22, color: INK }, paragraph: { spacing: { line: 300 } } },
      heading1: { run: { font: "Calibri", size: 34, bold: true, color: ACCENT } },
      heading2: { run: { font: "Calibri", size: 27, bold: true, color: "123E41" } },
      heading3: { run: { font: "Calibri", size: 23, bold: true, color: "123E41" } },
    },
  },
  sections: [
    {
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(process.argv[2] || "out.docx", buf);
  console.log("written", (buf.length / 1024).toFixed(0), "KB");
});
