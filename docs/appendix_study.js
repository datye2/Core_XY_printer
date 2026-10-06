// Mục "cách học" (chèn vào chương 0) và Phụ lục B (bài tập).
module.exports = {

howToStudy: function (H) {
  const { h2, h3, p, bullet, num, code, note, def, table, gap } = H;
  const out = []; const P = (...xs) => out.push(...xs.flat());

  P(h2("0.3 Cách học tài liệu này"));
  P(p("Tài liệu này không viết để đọc một lượt rồi cất. Đọc suông thì sau một tuần chỉ còn nhớ vài thuật ngữ. Phần dưới là lộ trình đã tính sao cho mỗi buổi học đều kết thúc bằng một thứ chạy được trên máy."));

  P(h3("Ba nguyên tắc"));
  P(num("**Luôn mở code bên cạnh.** Đọc một mục trong tài liệu, rồi mở ngay hàm tương ứng trong mã nguồn và đối chiếu. Hiểu thuật toán mà không nhận ra nó nằm ở dòng nào thì khi cần sửa vẫn bó tay. Phụ lục A sinh ra chính để làm việc này."));
  P(num("**Dự đoán trước, đo sau.** Trước mỗi lần nạp, viết ra giấy con số bạn nghĩ máy sẽ cho. Rồi mới chạy. Trùng thì kiến thức được xác nhận. Lệch thì bạn vừa tìm ra một chỗ mình hiểu sai, và đó mới là lúc học được nhiều nhất. Nếu chỉ chạy rồi gật gù thì não không ghi lại gì cả."));
  P(num("**Phá có chủ đích.** Cố tình làm hỏng một chi tiết, chạy, quan sát hậu quả, rồi sửa lại. Bỏ biến `rest` đi và nghe tiếng động cơ sẽ khắc sâu hơn mười lần đọc giải thích về nó."));
  P(...note("Vì sao nguyên tắc 2 quan trọng nhất:", "não chỉ ghi nhớ mạnh khi có **sai số dự đoán**. Đọc rồi đồng ý là hoạt động thụ động. Dự đoán 600 ms rồi thấy máy chạy 539 ms buộc bạn phải đi tìm lý do, và lý do đó sẽ nhớ rất lâu."));

  P(h3("Lộ trình tám buổi"));
  P(p("Mỗi buổi khoảng 60 tới 90 phút. Không nên nhảy cóc, vì các buổi sau dùng lại kết quả đo của buổi trước."));
  P(table(["Buổi", "Đọc", "Mở file", "Việc cần làm", "Coi như hiểu khi"],
    [["1", "Chương 1", "—", "Tự tính steps/mm cho puly 16 răng và vi bước 1/32", "Giải thích được vì sao vi bước không làm máy chính xác hơn"],
     ["2", "Chương 2", "stepper.c, hàm stepper_move_xy", "Tự tính ΔA, ΔB cho năm hướng đi bất kỳ", "Nói ngay được hướng nào thì motor nào đứng yên"],
     ["3", "Chương 3 và 6, phụ lục A.1", "stepper.h, A.1", "Chạy tay Bresenham với ΔA = 7, ΔB = 4 trên giấy", "Giải thích được vì sao phải volatile"],
     ["4", "Chương 6, phụ lục A.4.11", "stepper.c, hàm ISR", "Bài tập B.2 số 1 tới 3", "Chỉ ra được dòng nào phát xung, dòng nào đếm vị trí"],
     ["5", "Chương 7", "stepper.c, load_block", "Bài tập B.2 số 4 tới 7", "Tự tính được thời gian một lệnh chạy trước khi đo"],
     ["6", "Chương 8, phụ lục A.4.6", "stepper.c, recalculate", "Bài tập B.2 số 8 tới 10", "Giải thích được vì sao cần đủ hai lượt quét"],
     ["7", "Chương 9 và 10", "gcode.c, comms.c", "Tự viết một file G-code vẽ chữ cái đầu tên mình", "Sửa được parser để thêm một lệnh mới"],
     ["8", "Chương 11 và 12", "tools/", "Toàn bộ mục B.3, phá rồi sửa", "Đoán được chỗ hỏng trước khi đo"]],
    [0.5, 1.5, 1.7, 2.3, 2.5]));
  P(gap());

  P(h3("Cách tự kiểm tra đã hiểu thật chưa"));
  P(p("Ba phép thử, làm được cả ba thì chắc chắn đã hiểu, không phải chỉ thấy quen mặt:"));
  P(bullet("**Giải thích bằng lời, không nhìn tài liệu**, cho một người không biết gì, trong hai phút. Chỗ nào bạn phải nói mơ hồ là chỗ chưa nắm."));
  P(bullet("**Vẽ lại sơ đồ từ trí nhớ.** Ví dụ vẽ lại Hình 12 và nói rõ ranh giới đổi đơn vị nằm ở đâu, vì sao ở đó."));
  P(bullet("**Xoá một hàm nhỏ rồi viết lại từ đầu.** Bắt đầu bằng `junction_speed` hoặc `period_of`, chúng ngắn và độc lập. So với bản gốc xem khác chỗ nào."));

  P(h3("Bốn sai lầm thường gặp khi tự học firmware"));
  P(table(["Sai lầm", "Vì sao hại", "Làm thay thế"],
    [["Đọc hết một lượt rồi mới động vào máy", "quên gần hết trước khi tới phần thực hành", "mỗi chương đọc xong là chạy ngay một phép thử"],
     ["Chép code rồi chỉnh tới khi chạy", "chạy được mà không biết vì sao, lần sau hỏng là bó tay", "đọc hiểu rồi tự gõ lại, dù chậm hơn"],
     ["Bỏ qua phần mô phỏng Python", "mất công cụ kiểm tra rẻ nhất và nhanh nhất", "mô phỏng trước mỗi lần nạp"],
     ["Chỉ học khi mọi thứ chạy đúng", "bỏ lỡ phần giá trị nhất là gỡ lỗi", "chủ động phá theo mục B.3"]],
    [1.8, 2.3, 2.4]));
  P(gap());
  P(...def("Một mẹo nhỏ nhưng hiệu quả:", "ghi **nhật ký học** vào một file văn bản. Mỗi buổi viết ba dòng: hôm nay dự đoán gì, đo được gì, vì sao lệch. Sau tám buổi, đọc lại chính nhật ký đó sẽ thấy rõ mình tiến tới đâu, và những chỗ từng hiểu sai thường là những chỗ nhớ kỹ nhất."));

  return out;
},

exercises: function (H) {
  const { h1, h2, h3, p, bullet, num, code, note, def, table, gap, brk } = H;
  const out = []; const P = (...xs) => out.push(...xs.flat());

  P(brk(), h1("Phụ lục B. Bài tập thực hành"));
  P(p("Bài tập chia ba nhóm theo độ khó tăng dần: dự đoán rồi đo, phá rồi quan sát, và tự viết thêm tính năng. Đáp án đi kèm, nhưng chỉ nên xem sau khi đã tự làm."));

  P(h2("B.1 Chuẩn bị"));
  P(...code([
    "cd software/CoreXY",
    "cmake --build build/Debug                       # biên dịch",
    "./tools/flash_run.sh <dx> <dy> <tốc độ> <gia tốc>   # nạp và chạy một đoạn",
    "NOFLASH=1 ./tools/flash_run.sh 50 0 100 2000    # chạy lại, không nạp",
    "SPLIT=1   ./tools/flash_run.sh 100 0 150 2000   # chia thành 20 đoạn",
    "JOB=1     ./tools/flash_run.sh                  # chạy file G-code trong flash",
  ]));
  P(p("Đọc kết quả bằng gdb, sau khi chạy xong:"));
  P(...code([
    "openocd -f interface/jlink.cfg -c 'transport select swd' \\",
    "        -f target/stm32h7x.cfg &",
    "",
    "gdb-multiarch -q -batch build/Debug/CoreXY.elf \\",
    "  -ex 'target extended-remote :3333' \\",
    "  -ex 'printf \"%u ms  posA=%d posB=%d\\n\", step_test_ms, \\",
    "       (int)'\\''stepper.c'\\''::pos_a, (int)'\\''stepper.c'\\''::pos_b'",
  ]));
  P(...note("Nhớ:", "dấu nháy quanh `'stepper.c'::pos_a` là cú pháp của gdb để chỉ biến `static` thuộc một file cụ thể. Không có nó, gdb sẽ báo không tìm thấy ký hiệu, vì biến `static` không nằm trong bảng ký hiệu toàn cục."));

  P(h2("B.2 Mười bài dự đoán rồi đo"));
  P(p("Với mỗi bài: viết con số dự đoán ra giấy, chạy lệnh, rồi so. Sai quá 10% thì đọc lại mục được ghi ở cột cuối."));
  P(table(["#", "Lệnh chạy", "Câu hỏi dự đoán", "Đọc lại mục nào nếu sai"],
    [["1", "flash_run.sh 50 0 20 2000", "Mất bao nhiêu mili giây?", "7.2"],
     ["2", "flash_run.sh 50 0 100 2000", "Mất bao lâu, và nhanh hơn bài 1 mấy lần?", "7.2"],
     ["3", "flash_run.sh 50 0 100 5000", "Tăng gia tốc 2.5 lần thì nhanh hơn bao nhiêu?", "7.2"],
     ["4", "flash_run.sh 50 0 100 500", "Giảm gia tốc 4 lần thì chậm đi bao nhiêu?", "7.2"],
     ["5", "flash_run.sh 2 0 150 2000", "Tốc độ đỉnh thật sự đạt được là bao nhiêu?", "7.6"],
     ["6", "flash_run.sh 100 0 400 2000", "Có chạy không, hay báo lỗi?", "A.4.9 khối 4"],
     ["7", "flash_run.sh 71 71 400 2000", "Cùng tốc độ nhưng đi chéo, kết quả khác gì bài 6?", "2.5 và 7.3"],
     ["8", "flash_run.sh 71 71 150 2000", "posA và posB bằng bao nhiêu sau khi chạy?", "2.2"],
     ["9", "SPLIT=1 ... 100 0 150 2000", "So với một đoạn liền, chênh bao nhiêu?", "8.5"],
     ["10", "JOB=1 flash_run.sh", "File 48 dòng chạy hết bao lâu?", "9.4"]],
    [0.4, 2.1, 2.6, 1.3]));
  P(gap());

  P(h3("Đáp án"));
  P(table(["#", "Kết quả", "Giải thích"],
    [["1", "khoảng 2506 ms", "gần bằng 50/20 = 2.5 giây, phần tăng giảm tốc không đáng kể ở tốc độ thấp"],
     ["2", "khoảng 539 ms", "không nhanh gấp 5 lần vì giờ phần tăng giảm tốc chiếm tỉ lệ đáng kể"],
     ["3", "khoảng 524 ms, chỉ nhanh hơn 3%", "**bài học quan trọng**: ở đoạn dài, gia tốc gần như không ảnh hưởng, vì phần lớn thời gian là chạy đều"],
     ["4", "khoảng 610 ms, chậm hơn 13%", "cùng lý do, tác động nhỏ hơn ta tưởng"],
     ["5", "đỉnh chỉ 74.9 mm/s, hết 50 ms", "đoạn quá ngắn, profile thành tam giác"],
     ["6", "chạy được, khoảng 416 ms", "400 mm/s đi thẳng cần 32 kHz, dưới trần 40 kHz"],
     ["7", "**STEPPER_ERROR**, không chạy", "đi chéo cần 45 kHz, vượt trần. Đây là hệ số căn hai bằng xương bằng thịt"],
     ["8", "posA = 11314, posB = 0", "ΔB bằng 0 nên motor B không quay một bước nào"],
     ["9", "cả hai đều 728 ms", "chia nhỏ không tốn thêm gì, đó là toàn bộ ý nghĩa của nhìn trước"],
     ["10", "khoảng 9.4 giây", "799 mm đường đi, chậm hơn 799/100 = 8 giây vì có góc và tăng giảm tốc"]],
    [0.4, 1.7, 3.9]));
  P(gap());
  P(...note("Bài 3 và 4 đáng suy ngẫm nhất:", "nhiều người tưởng tăng gia tốc là máy nhanh lên hẳn. Thực tế với đoạn dài thì gần như không đổi. Gia tốc chỉ thật sự quan trọng khi in chi tiết nhỏ với hàng nghìn đoạn ngắn, vì khi đó máy **gần như không bao giờ chạy đều**. Muốn thấy rõ, chạy lại bài 9 với gia tốc 500 rồi với 5000 và so."));

  P(h2("B.3 Năm thí nghiệm phá hỏng có chủ đích"));
  P(p("Mỗi thí nghiệm: sửa một chỗ, biên dịch, chạy, quan sát, rồi **khôi phục lại**. Nên commit trước khi phá để `git checkout` là về nguyên trạng."));

  P(h3("Thí nghiệm 1: bỏ biến rest"));
  P(...code([
    "// trong stepper_tim2_isr, nhánh tăng tốc, đổi thành:",
    "uint32_t num = 2U * c;        // bỏ + rest",
    "c -= num / den;",
    "// bỏ luôn dòng rest = num % den;",
  ]));
  P(p("**Chạy**: `flash_run.sh 100 0 150 2000`. **Dự đoán trước khi chạy**: thời gian sẽ tăng hay giảm, và vì sao."));
  P(p("**Kết quả mong đợi**: lệnh chạy lâu hơn hẳn. Đường dốc khựng lại ở một tốc độ thấp và không bao giờ đạt 150 mm/s, vì tới một lúc phép chia luôn cho ra 0. Xem lại mục 7.5."));

  P(h3("Thí nghiệm 2: bỏ i_offset"));
  P(...code([
    "// trong load_block:",
    "i_offset = 0;    // thay vì (v_entry*v_entry)/(2a)",
  ]));
  P(p("**Chạy**: `SPLIT=1 flash_run.sh 100 0 150 2000`. **Dự đoán**: hai mươi đoạn ngắn sẽ chạy ra sao."));
  P(p("**Kết quả mong đợi**: mỗi đoạn mới lại bắt đầu đường dốc từ đầu, dù đang chạy ở tốc độ cao. Chu kỳ bị kéo dài đột ngột ở mỗi ranh giới đoạn, nghe rõ tiếng giật và tổng thời gian tăng. Xem mục 8.4."));

  P(h3("Thí nghiệm 3: khởi tạo Bresenham bằng 0"));
  P(...code([
    "// trong load_block:",
    "err_a = err_b = 0;    // thay vì b->n / 2",
  ]));
  P(p("**Chạy**: một đoạn chéo không cân, ví dụ `flash_run.sh 60 20 60 2000`. **Dự đoán**: hình dạng quỹ đạo có đổi không, vị trí cuối có đúng không."));
  P(p("**Kết quả mong đợi**: vị trí cuối vẫn **đúng tuyệt đối**, vì tổng số bước không đổi. Chỉ phân bố bước hơi lệch về một phía nên chuyển động kém mượt hơn một chút. Đây là ví dụ tốt cho thấy không phải lỗi nào cũng làm sai kết quả, có loại chỉ làm giảm chất lượng."));

  P(h3("Thí nghiệm 4: tăng junction deviation lên mười lần"));
  P(...code([
    "// trong main, trước khi chạy job:",
    "stepper_set_junction_deviation(0.5f);   // mặc định 0.05",
  ]));
  P(p("**Chạy**: `JOB=1 flash_run.sh`, chú ý ngôi sao năm cánh. **Dự đoán**: nhanh hơn hay chậm hơn, và hình có đổi không."));
  P(p("**Kết quả mong đợi**: chạy nhanh hơn thấy rõ, nhưng các góc nhọn của ngôi sao bị bo tròn và nghe tiếng va đập ở mỗi góc. Đây chính là sự đánh đổi mà tham số này điều khiển. Thử tiếp giá trị 0.01 để thấy chiều ngược lại."));

  P(h3("Thí nghiệm 5: bỏ bus_gap trong tmc2209.c"));
  P(...code([
    "// trong transfer(), bỏ dòng:",
    "bus_gap();",
  ]));
  P(p("**Chạy**: nạp rồi đọc `tmc_status[0]` và `tmc_status[1]`. **Dự đoán**: cấu hình driver còn thành công không."));
  P(p("**Kết quả mong đợi**: gói đầu tiên vẫn tốt, các gói sau trả về rác, `tmc_status` khác 0. Đây đúng là lỗi thật đã gặp khi dựng máy, mô tả ở mục 4.5. Xem `tmc2209_dbg.rx` để thấy byte bị lệch bit."));

  P(h2("B.4 Ba bài tự viết thêm"));
  P(p("Khó hơn hẳn ba nhóm trên, vì không có sẵn đáp án. Đây là lúc kiểm tra xem đã thật sự nắm kiến trúc chưa."));
  P(h3("Bài 1: thêm lệnh báo vị trí M114"));
  P(p("Hầu hết firmware máy in đều có lệnh `M114` trả về toạ độ hiện tại. Hiện parser đang **bỏ qua** mọi lệnh M. Hãy làm cho riêng `M114` trả về một dòng dạng `X:12.34 Y:56.78`."));
  P(bullet("Gợi ý: phải sửa ở `gcode.c`, chỗ xử lý chữ M. Chú ý parser hiện không lưu lại số đi sau chữ M."));
  P(bullet("Câu hỏi thiết kế: in ra bằng cách nào, vì `gcode.c` không biết gì về `comms.c`? Cách sạch sẽ là gì, trả chuỗi ra ngoài hay gọi thẳng?"));

  P(h3("Bài 2: giới hạn vùng làm việc"));
  P(p("Thêm kiểm tra phần mềm: nếu lệnh đưa đầu in ra ngoài khoảng 0 tới 200 mm ở cả hai trục thì từ chối và trả về lỗi."));
  P(bullet("Câu hỏi: nên đặt kiểm tra ở lớp nào, `gcode.c`, `motion_control.c` hay `stepper.c`? Vì sao?"));
  P(bullet("Câu hỏi khó hơn: kiểm tra theo vị trí planner hay vị trí motor thật? Hai cái khác nhau khi hàng đợi còn đầy."));

  P(h3("Bài 3: đổi sang cơ cấu Cartesian"));
  P(p("Giả sử bạn muốn dùng chính firmware này cho một máy Cartesian thường, nơi motor A lo trục X còn motor B lo trục Y."));
  P(bullet("Cần sửa bao nhiêu dòng? Ở những file nào?"));
  P(bullet("Phần gia tốc, Bresenham và nhìn trước có phải sửa gì không? Vì sao?"));
  P(...note("Đáp án cho bài 3:", "chỉ cần sửa hai công thức trong `stepper_move_xy` thành `ΔA = ΔX` và `ΔB = ΔY`, cùng hai hàm `stepper_pos_x` và `stepper_pos_y`. Khoảng bốn dòng. Mọi thứ khác không phải đụng tới, vì chúng chỉ làm việc với `n` và `length_mm`. Nếu bạn trả lời được câu này thì coi như đã nắm được điểm cốt lõi của toàn bộ kiến trúc."));

  P(h2("B.5 Bảng tự đánh giá"));
  P(p("Đánh dấu khi tự tin làm được mà không cần mở tài liệu:"));
  P(table(["Mức", "Tôi có thể..."],
    [["Hiểu", "Giải thích vì sao CoreXY cần cả hai motor cho mọi chuyển động"],
     ["Hiểu", "Nói được vì sao phải có gia tốc, và pull-in rate là gì"],
     ["Hiểu", "Giải thích Bresenham bằng một ví dụ tự nghĩ ra"],
     ["Vận dụng", "Tính trước thời gian của một lệnh chạy và sai số dưới 10%"],
     ["Vận dụng", "Chỉ ra dòng code tương ứng với bất kỳ công thức nào trong tài liệu"],
     ["Vận dụng", "Dùng gdb đọc được biến bất kỳ trên chip đang chạy"],
     ["Phân tích", "Nhìn một triệu chứng lạ và đoán được nên đo chỗ nào trước"],
     ["Phân tích", "Nói được biến nào cần volatile, biến nào không, và vì sao"],
     ["Sáng tạo", "Thêm một tính năng mới mà đặt đúng lớp"],
     ["Sáng tạo", "Chuyển firmware sang cơ cấu động học khác"]],
    [0.9, 4.1]));
  P(gap());
  P(p("Đạt hết mức Vận dụng là đã đủ để tự tiếp tục dự án: làm homing, thêm trục Z, điều khiển nhiệt độ. Đạt mức Phân tích là tự gỡ được lỗi mới mà không cần ai hướng dẫn."));

  return out;
},

};
