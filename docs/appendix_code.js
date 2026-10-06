// Phụ lục A: đọc code. Nhận các hàm trợ giúp từ make_doc.js.
module.exports = function (H) {
  const { h1, h2, h3, p, bullet, num, code, note, def, table, gap, brk } = H;
  const out = [];
  const P = (...xs) => out.push(...xs.flat());

  P(brk(), h1("Phụ lục A. Đọc code"));
  P(p("Phần chính của tài liệu giải thích thuật toán. Phụ lục này đi vào chính những dòng code đang chạy trên máy, giải thích từng khối một, kể cả các cú pháp C mà người mới làm nhúng thường bị vướng."));
  P(p("Cách dùng hiệu quả nhất: mở file nguồn tương ứng bên cạnh và đọc song song."));

  // ================= A.1 =================
  P(h2("A.1 Tám thứ phải hiểu trước khi đọc bất kỳ dòng nào"));
  P(p("Toàn bộ firmware chỉ dùng đi dùng lại tám mẫu cú pháp dưới đây. Hiểu một lần là đọc được mọi file."));

  P(h3("1. static: giới hạn tầm nhìn của biến và hàm"));
  P(...code([
    "static float pos_x_mm = 0.0f;",
    "static void delay_us(uint32_t us) { ... }",
  ]));
  P(p("Đặt `static` trước một biến hoặc hàm ở cấp file nghĩa là **chỉ file này thấy nó**. File khác muốn dùng cũng không được, trình liên kết sẽ báo không tìm thấy."));
  P(p("Vì sao làm vậy: `stepper.c` có khoảng hai mươi biến trạng thái. Nếu để lộ hết ra ngoài thì bất kỳ file nào cũng sửa được, và khi có lỗi phải đi tìm khắp dự án. Để `static` thì phạm vi nghi ngờ thu lại còn đúng một file."));
  P(...note("Lưu ý một nghĩa khác của static:", "khi đặt bên trong một hàm, `static` nghĩa hoàn toàn khác: biến đó giữ giá trị giữa các lần gọi, không bị khởi tạo lại. Ví dụ `static const uint8_t addr[2]` trong `tmc_setup()` chỉ được tạo một lần, không phải dựng lại mảng mỗi lần gọi."));

  P(h3("2. volatile: cấm trình biên dịch khôn lỏi"));
  P(p("Đây là từ khoá quan trọng nhất trong lập trình nhúng, và cũng là nguồn lỗi khó tìm nhất khi quên."));
  P(p("Trình biên dịch luôn tìm cách chạy nhanh hơn. Thấy một biến được đọc nhiều lần mà không có lệnh nào ghi vào nó, nó sẽ đọc một lần rồi **giữ trong thanh ghi CPU** và dùng lại, không thèm đọc lại từ bộ nhớ. Bình thường thì vô hại và nhanh hơn thật."));
  P(p("Nhưng với firmware thì sai, vì có hai thứ ghi vào bộ nhớ mà trình biên dịch không nhìn thấy: **ngắt** và **phần cứng**."));
  P(...code([
    "// Không có volatile, vòng này có thể chạy mãi mãi:",
    "while (events_left != 0) { }",
    "",
    "// Trình biên dịch nghĩ: trong vòng lặp không ai sửa events_left,",
    "// vậy đọc một lần là đủ. Nó dịch thành:",
    "//     nạp events_left vào thanh ghi r0",
    "//     nếu r0 != 0 thì nhảy về chính nó        ← treo vĩnh viễn",
    "",
    "// Có volatile, nó buộc phải đọc lại từ RAM mỗi vòng:",
    "static volatile int32_t events_left;",
  ]));
  P(p("Quy tắc đơn giản: **mọi biến mà cả ISR lẫn vòng lặp chính cùng đụng tới đều phải là volatile**. Trong `stepper.c`, đó là toàn bộ nhóm biến dưới dòng chú thích `Executor side (ISR)`."));
  P(p("Ngược lại, nhóm biến `Planner side` như `pos_x_mm`, `plan_a` **không** cần volatile, vì chỉ vòng lặp chính đụng vào. Đánh dấu volatile thừa sẽ làm code chậm đi vô ích."));

  P(h3("3. Kiểu số có kích thước rõ ràng"));
  P(table(["Kiểu", "Kích thước", "Phạm vi", "Dùng ở đâu trong dự án"],
    [["uint8_t", "1 byte", "0 … 255", "chỉ số hàng đợi, cờ bật tắt"],
     ["int8_t", "1 byte", "−128 … 127", "chiều quay, chỉ nhận +1 hoặc −1"],
     ["int32_t", "4 byte", "±2.1 tỉ", "số bước, vị trí, bộ đếm"],
     ["uint32_t", "4 byte", "0 … 4.3 tỉ", "chu kỳ µs, giá trị thanh ghi"],
     ["float", "4 byte", "~7 chữ số có nghĩa", "mm, mm/s, chỉ ở lớp planner"]],
    [1, 0.9, 1.4, 2.4]));
  P(gap());
  P(p("Lý do không dùng `int` trơn: kích thước của `int` phụ thuộc vào chip và trình biên dịch. Trên vi điều khiển, một biến tràn số là một lỗi im lặng, nên phải nói rõ muốn bao nhiêu byte."));
  P(p("Ví dụ cụ thể trong dự án: `int32_t pos_a` đếm vị trí bằng số bước. Với 80 bước mỗi mm, kiểu 32 bit chứa được 26 triệu mm, tức 26 km. Nếu dùng `int16_t` thì chỉ được 409 mm và sẽ tràn ngay."));

  P(h3("4. struct và con trỏ: dấu chấm hay mũi tên"));
  P(...code([
    "block_t *b = &queue[q_head];     // b là con trỏ, trỏ tới phần tử trong mảng",
    "b->n = n;                        // qua con trỏ thì dùng mũi tên",
    "queue[q_head].n = n;             // truy cập trực tiếp thì dùng dấu chấm",
  ]));
  P(p("Hai dòng cuối làm việc **giống hệt nhau**. Dùng con trỏ chỉ để khỏi phải viết `queue[q_head].` lặp lại hai mươi lần, và để trình biên dịch tính địa chỉ một lần thay vì mỗi dòng một lần."));
  P(p("Ký hiệu `&` trước một biến nghĩa là **lấy địa chỉ của nó**. `&queue[q_head]` là địa chỉ của phần tử đó trong bộ nhớ."));

  P(h3("5. Thanh ghi ngoại vi: TIM2->ARR thực chất là gì"));
  P(p("Dòng `TIM2->ARR = 83;` trông giống gán cho một trường trong struct, và đúng là như vậy về mặt cú pháp. Nhưng struct đó **không nằm trong RAM**."));
  P(...def("Ánh xạ bộ nhớ (memory mapped I/O):", "các khối ngoại vi như timer, UART, GPIO được nhà sản xuất gán cho những địa chỉ cố định trong không gian địa chỉ của CPU. Ghi vào địa chỉ đó không phải là lưu dữ liệu, mà là **ra lệnh cho phần cứng**. Thư viện của ST định nghĩa sẵn một struct đặt đúng vào địa chỉ ấy, nên viết `TIM2->ARR` chính là ghi vào thanh ghi ARR của bộ timer số 2."));
  P(...code([
    "// Trong file của ST, rút gọn:",
    "#define TIM2  ((TIM_TypeDef *) 0x40000000UL)",
    "",
    "typedef struct {",
    "  volatile uint32_t CR1;    // offset 0x00",
    "  volatile uint32_t CR2;    // offset 0x04",
    "  ...",
    "  volatile uint32_t ARR;    // offset 0x2C",
    "} TIM_TypeDef;",
    "",
    "// Nên TIM2->ARR = 83  nghĩa là  ghi 83 vào địa chỉ 0x4000002C",
  ]));
  P(p("Để ý mọi trường đều là `volatile`, vì chính phần cứng cũng thay đổi chúng."));

  P(h3("6. Phép toán bit: bật, tắt, kiểm tra một bit"));
  P(p("Một thanh ghi 32 bit thường chứa nhiều công tắc độc lập. Muốn sửa một công tắc mà không đụng các công tắc khác thì phải dùng phép bit."));
  P(...code([
    "TIM2->DIER |= TIM_DIER_UIE;        // BẬT bit UIE, giữ nguyên các bit khác",
    "TIM2->CR1  &= ~TIM_CR1_CEN;        // TẮT bit CEN, giữ nguyên các bit khác",
    "if (sr & TIM_SR_UIF) { ... }       // KIỂM TRA bit UIF có đang bật không",
  ]));
  P(table(["Cách viết", "Nghĩa", "Giải thích"],
    [["x |= M", "bật các bit trong M", "hoặc bit: 0|1 = 1, còn bit nào không nằm trong M thì giữ nguyên vì 0|0 = 0"],
     ["x &= ~M", "tắt các bit trong M", "`~M` đảo mọi bit của M, nên chỗ cần tắt thành 0, chỗ khác thành 1 và `và` với 1 là giữ nguyên"],
     ["x & M", "kiểm tra", "khác 0 nghĩa là có ít nhất một bit trong M đang bật"]],
    [1, 1.4, 3.6]));
  P(gap());
  P(p("Các tên như `TIM_DIER_UIE` là hằng số do ST định nghĩa, bên trong chỉ là một con số có đúng một bit bằng 1. Dùng tên thay vì số giúp đọc hiểu và tránh gõ nhầm."));

  P(h3("7. BSRR: cách đúng để đổi một chân GPIO trong ngắt"));
  P(p("Cách thông thường để đổi một chân là đọc thanh ghi trạng thái, sửa một bit, rồi ghi lại. Ba thao tác, và nguy hiểm: nếu giữa chừng có một ngắt khác cũng sửa chân trên cùng cổng, thay đổi của nó sẽ bị đè mất."));
  P(...def("BSRR (Bit Set/Reset Register):", "thanh ghi đặc biệt chỉ để ghi. 16 bit thấp dùng để **bật** chân tương ứng, 16 bit cao dùng để **tắt**. Ghi bit nào bằng 1 thì chân đó đổi, ghi 0 thì không ảnh hưởng. Chỉ một thao tác ghi duy nhất, không đọc, nên không bao giờ bị ngắt chen vào giữa."));
  P(...code([
    "A_STEP_PORT->BSRR = A_STEP_PIN;                  // kéo chân STEP lên 1",
    "A_STEP_PORT->BSRR = (uint32_t)A_STEP_PIN << 16U; // kéo chân STEP xuống 0",
  ]));
  P(p("Dịch trái 16 bit tức chuyển mặt nạ từ nửa bật sang nửa tắt. Trong ISR của dự án, mọi thao tác chân STEP đều dùng cách này, vừa an toàn vừa nhanh hơn gọi hàm thư viện."));

  P(h3("8. Ba cú pháp rút gọn hay gặp"));
  P(...code([
    "dir_a = (da >= 0) ? 1 : -1;        // toán tử ba ngôi: if rút gọn",
    "                                   // nếu da >= 0 thì lấy 1, ngược lại lấy -1",
    "",
    "int32_t n = (int32_t)lroundf(x);   // ép kiểu: buộc đổi sang int32_t",
    "",
    "d    = num / den;                  // chia số nguyên: 7/2 = 3, phần lẻ bị cắt",
    "rest = num % den;                  // lấy phần dư:    7%2 = 1",
  ]));
  P(p("Cặp `/` và `%` chính là nền tảng của cả Bresenham lẫn thuật toán gia tốc. Phần nguyên dùng ngay, phần dư giữ lại cho lần sau."));

  // ================= A.2 =================
  P(brk(), h2("A.2 Bản đồ các file"));
  P(table(["File", "Dòng", "Nhiệm vụ", "Ai gọi nó"],
    [["module/stepper.c", "~530", "planner và bộ phát xung, trái tim của firmware", "motion_control, và ngắt TIM2"],
     ["module/motion_control.c", "~90", "giữ vị trí tuyệt đối, chia cung tròn", "gcode"],
     ["module/gcode.c", "~160", "đọc chữ, hiểu lệnh", "comms, hoặc vòng chạy job"],
     ["module/comms.c", "~170", "giao thức dòng lệnh qua USB", "ngắt USB, và vòng lặp chính"],
     ["module/tmc2209.c", "~230", "cấu hình driver qua UART", "main lúc khởi động"],
     ["Core/Src/main.c", "~190", "khởi tạo theo thứ tự, vòng lặp chính", "khởi động chip"],
     ["Core/Src/stm32h7xx_it.c", "—", "các hàm ngắt, chỉ gọi sang module", "phần cứng"]],
    [1.8, 0.7, 2.6, 1.9]));
  P(gap());
  P(p("Thứ tự nên đọc: `main.c` để thấy toàn cảnh, rồi `stepper.h` để biết giao diện, rồi `stepper.c` từ trên xuống. Ba file còn lại đọc lúc nào cũng được."));

  // ================= A.3 =================
  P(h2("A.3 stepper.h: giao diện nói lên thiết kế"));
  P(p("Đọc file header trước khi đọc file nguồn là thói quen tốt: nó cho biết module này hứa làm gì, và giấu đi những gì."));
  P(...code([
    "typedef enum {",
    "  STEPPER_OK = 0,",
    "  STEPPER_BUSY,      /* hàng đợi đầy, thử lại sau */",
    "  STEPPER_ERROR      /* tốc độ ngoài khoảng cho phép */",
    "} stepper_status_t;",
    "",
    "stepper_status_t stepper_move_xy(float dx, float dy, float speed);",
    "void     stepper_set_accel(float a);",
    "uint8_t  stepper_busy(void);",
    "uint8_t  stepper_queue_free(void);",
    "void     stepper_wait(void);",
    "void     stepper_abort(void);",
    "void     stepper_tim2_isr(void);",
    "int32_t  stepper_pos_a(void);",
  ]));
  P(p("Ba điều đọc ra được từ đây:"));
  P(num("**Header không include gì của HAL**, chỉ `<stdint.h>`. Nghĩa là lớp trên không cần biết chip nào, thư viện nào. Đổi sang chip khác thì chỉ `stepper.c` phải sửa."));
  P(num("**Trả về mã lỗi thay vì void.** Mọi lời gọi đều có thể thất bại, và người gọi buộc phải nhìn thấy điều đó."));
  P(num("**Có `stepper_queue_free()`.** Hàm này tồn tại vì lớp trên cần biết còn bao nhiêu chỗ để quyết định có gửi tiếp hay không, thay vì gửi bừa rồi bị từ chối."));
  P(...note("Vì sao `stepper_tim2_isr` lại nằm trong header:", "hàm ngắt thật sự nằm trong `stm32h7xx_it.c` do CubeMX sinh ra. File đó chỉ gọi sang đây một dòng. Làm vậy để khi CubeMX sinh lại code, phần logic của mình không bị ghi đè."));

  // ================= A.4 =================
  P(brk(), h2("A.4 stepper.c, đọc từ trên xuống"));

  P(h3("A.4.1 Nhóm hằng số: mỗi con số là một quyết định"));
  P(...code([
    "#define STEPS_PER_MM      80.0f",
    "#define TIM_TICK_HZ       1000000.0f",
    "#define STEP_PULSE_US     2U",
    "#define MIN_PERIOD_US     25U",
    "#define START_PERIOD_US   2000U",
    "#define DEFAULT_ACCEL     2000.0f",
    "#define DEFAULT_JD        0.05f",
    "#define QUEUE_SIZE        32U",
    "#define QUEUE_MASK        (QUEUE_SIZE - 1U)",
  ]));
  P(table(["Hằng số", "Vì sao là con số đó"],
    [["STEPS_PER_MM 80", "từ puly 20 răng và vi bước 1/16, xem mục 1.4"],
     ["TIM_TICK_HZ 1 MHz", "do prescaler 239 trên clock 240 MHz, nên một nhịp là 1 µs"],
     ["STEP_PULSE_US 2", "driver cần tối thiểu khoảng 100 ns, lấy 2 µs cho chắc"],
     ["MIN_PERIOD_US 25", "trần 40 kHz mỗi motor, là mức động cơ còn theo được"],
     ["START_PERIOD_US 2000", "tốc độ khởi động 6 mm/s, chậm hơn nữa là phí thời gian"],
     ["QUEUE_SIZE 32", "đủ sâu để nhìn trước khi stream đoạn ngắn, mà vẫn ít RAM"]],
    [1.5, 3.5]));
  P(gap());
  P(...note("Vì sao QUEUE_SIZE phải là luỹ thừa của 2:", "để phép quay vòng chỉ số làm được bằng phép `và` bit thay vì phép chia lấy dư. Với 32 phần tử, `QUEUE_MASK` bằng 31, tức nhị phân là 11111. Phép `(i + 1) & 31` cho kết quả giống hệt `(i + 1) % 32` nhưng nhanh hơn nhiều, vì phép chia trên vi điều khiển tốn hàng chục chu kỳ còn phép `và` chỉ tốn một."));

  P(h3("A.4.2 block_t: một đoạn chuyển động trông như thế nào"));
  P(...code([
    "typedef struct {",
    "  int32_t steps_a, steps_b;    // số bước, luôn dương",
    "  int8_t  dir_a, dir_b;        // chiều, +1 hoặc -1",
    "  int32_t n;                   // số nhịp = max(steps_a, steps_b)",
    "",
    "  float length_mm;             // chiều dài đoạn trong XY",
    "  float ux, uy;                // vector đơn vị chỉ hướng",
    "  float accel;",
    "",
    "  float nominal_speed;         // tốc độ được yêu cầu",
    "  float max_entry_speed;       // trần do góc nối quyết định",
    "  float entry_speed;           // tốc độ vào mà planner chốt",
    "} block_t;",
  ]));
  P(p("Ba trường tốc độ dễ nhầm, nên phân biệt rõ:"));
  P(bullet("**nominal_speed** là mong muốn, lấy từ lệnh F trong G-code. Không bao giờ bị sửa."));
  P(bullet("**max_entry_speed** là trần vật lý do hình học góc nối, tính một lần khi đoạn được xếp hàng. Cũng không bị sửa sau đó."));
  P(bullet("**entry_speed** là kết quả cuối cùng sau hai lượt quét. **Trường duy nhất bị thay đổi nhiều lần**, mỗi khi có đoạn mới vào hàng đợi."));
  P(...def("Vector đơn vị:", "một cặp số (ux, uy) chỉ hướng đi, với độ dài bằng đúng 1. Tính bằng cách chia mỗi thành phần cho chiều dài: `ux = dx / length`. Lưu nó sẵn để sau này tính góc giữa hai đoạn chỉ bằng một phép nhân vô hướng, không phải gọi hàm lượng giác."));

  P(h3("A.4.3 Hàng đợi vòng"));
  P(...code([
    "static block_t queue[QUEUE_SIZE];",
    "static volatile uint8_t q_head = 0;   // nơi planner ghi vào",
    "static volatile uint8_t q_tail = 0;   // nơi ISR đang chạy",
    "",
    "static uint8_t q_next(uint8_t i) { return (i + 1U) & QUEUE_MASK; }",
  ]));
  P(...def("Hàng đợi vòng (ring buffer):", "một mảng cố định được dùng như vòng tròn. Khi chỉ số chạm cuối mảng thì quay lại đầu. Nhờ vậy không bao giờ phải cấp phát bộ nhớ động, và không phải dịch chuyển dữ liệu khi lấy phần tử ra."));
  P(p("Hai chỉ số đóng hai vai khác nhau, và đây là điểm mấu chốt về an toàn:"));
  P(table(["Chỉ số", "Ai được sửa", "Ý nghĩa"],
    [["q_head", "chỉ vòng lặp chính", "ô trống kế tiếp để ghi đoạn mới vào"],
     ["q_tail", "chỉ ISR", "đoạn đang được chạy"]],
    [1, 1.6, 3.4]));
  P(gap());
  P(p("Mỗi bên chỉ ghi vào chỉ số của riêng mình và chỉ đọc chỉ số của bên kia. Nhờ quy ước này, **không cần khoá hay vùng loại trừ** cho hàng đợi, hai bên không bao giờ ghi đè nhau."));
  P(...code([
    "rỗng:  q_head == q_tail",
    "đầy:   q_next(q_head) == q_tail      // hy sinh một ô để phân biệt",
  ]));
  P(p("Phải hy sinh một ô vì nếu cho phép dùng hết 32 ô thì trạng thái đầy và trạng thái rỗng đều cho `head == tail`, không phân biệt được. Vì vậy `stepper_queue_free()` trả về tối đa 31 chứ không phải 32."));

  P(h3("A.4.4 Hai nhóm biến trạng thái"));
  P(p("Đây là chỗ thể hiện rõ nhất ranh giới kiến trúc của chương 3. Code chia biến thành hai nhóm có chú thích riêng:"));
  P(table(["Nhóm planner", "Nhóm executor (ISR)"],
    [["`pos_x_mm`, `pos_y_mm` — vị trí đầu in theo lệnh", "`pos_a`, `pos_b` — vị trí motor đã chạy thật"],
     ["`plan_a`, `plan_b` — vị trí motor theo lệnh", "`steps_a`, `steps_b`, `err_a`, `err_b` — Bresenham"],
     ["`prev_ux`, `prev_uy` — hướng đoạn vừa xếp hàng", "`c`, `c_min`, `rest` — profile tốc độ"],
     ["`accel_mm_s2`, `junction_dev` — tham số", "`events_left`, `cruise_from`, `decel_from`"],
     ["**không** volatile, đơn vị mm, số thực", "**đều** volatile, đơn vị nhịp, số nguyên"]],
    [1, 1]));
  P(gap());
  P(...note("Vì sao có tới hai cặp biến vị trí:", "`plan_a` là nơi planner **tin rằng** đầu in sẽ tới sau khi chạy hết hàng đợi. `pos_a` là nơi motor **đang thật sự** ở. Khi hàng đợi còn 10 đoạn chưa chạy, hai con số này cách nhau rất xa, và điều đó là bình thường. Chúng chỉ bằng nhau khi hàng đợi rỗng. Lệnh dừng khẩn phải kéo `plan_a` về bằng `pos_a`, nếu không toạ độ sẽ sai vĩnh viễn."));

  P(h3("A.4.5 delay_us và bộ đếm chu kỳ"));
  P(...code([
    "static void delay_us(uint32_t us)",
    "{",
    "  uint32_t start = DWT->CYCCNT;",
    "  uint32_t ticks = us * (SystemCoreClock / 1000000U);",
    "  while ((DWT->CYCCNT - start) < ticks) { }",
    "}",
  ]));
  P(...def("DWT->CYCCNT:", "một bộ đếm 32 bit nằm trong lõi Cortex-M, tăng đúng một đơn vị mỗi chu kỳ CPU. Ở 480 MHz, nó tăng 480 lần mỗi micro giây. Vốn sinh ra để đo hiệu năng, nhưng dùng làm đồng hồ chính xác rất tiện."));
  P(p("Phép trừ `DWT->CYCCNT - start` hoạt động đúng **kể cả khi bộ đếm tràn** từ giá trị lớn nhất về 0. Lý do: số học trên kiểu không dấu trong C được định nghĩa là lấy phần dư, nên hiệu vẫn ra đúng khoảng cách. Đây là một mẹo chuẩn mực, không phải may mắn."));
  P(p("Hàm này **chỉ được gọi từ vòng lặp chính**, cụ thể là lúc chờ chân DIR ổn định. Không bao giờ gọi trong ISR."));

  P(h3("A.4.6 recalculate: hai lượt quét"));
  P(p("Đây là hàm khó đọc nhất file, nên tách ra từng mảnh."));
  P(...code([
    "static float speed_after(float v0, float accel, float distance)",
    "{",
    "  return sqrtf(v0 * v0 + 2.0f * accel * distance);",
    "}",
  ]));
  P(p("Chỉ là công thức vật lý quen thuộc v² = v₀² + 2as, viết lại thành v. Trả lời câu hỏi: _xuất phát ở tốc độ v0, tăng tốc đều trên quãng đường s, thì đạt tốc độ bao nhiêu_."));
  P(...code([
    "  uint8_t first = q_tail;",
    "  if (running)",
    "    first = q_next(q_tail);     // không đụng vào đoạn ISR đang chạy",
    "  if (first == q_head)",
    "    return;                     // không còn đoạn nào để tính",
  ]));
  P(p("Khối này xác định **đoạn đầu tiên được phép sửa**. Nếu timer đang chạy thì đoạn ở `q_tail` đã nạp vào ISR và đường dốc của nó đã khởi động, sửa lúc này là sai lệch chuyển động. Nên bỏ qua, bắt đầu từ đoạn kế tiếp."));
  P(...code([
    "  /* lượt lùi */",
    "  uint8_t i = q_head;",
    "  float next_entry = 0.0f;      // cuối hàng đợi thì phải dừng hẳn",
    "  while (i != first)",
    "  {",
    "    i = (uint8_t)((i + QUEUE_MASK) & QUEUE_MASK);   // i--, có quay vòng",
    "    block_t *b = &queue[i];",
    "    float reachable = speed_after(next_entry, b->accel, b->length_mm);",
    "    float v = b->max_entry_speed;",
    "    if (reachable < v) v = reachable;",
    "    if (b->nominal_speed < v) v = b->nominal_speed;",
    "    b->entry_speed = v;",
    "    next_entry = v;",
    "    if (i == first) break;",
    "  }",
  ]));
  P(p("Đọc từng ý:"));
  P(bullet("`next_entry = 0` ở đầu: planner luôn giả định đoạn cuối hàng đợi là đoạn cuối cùng của cả công việc, nên phải dừng hẳn. Nếu lát nữa có đoạn mới được xếp vào, hàm này chạy lại và con số sẽ được nới ra."));
  P(bullet("`(i + QUEUE_MASK) & QUEUE_MASK` là cách lùi chỉ số một bước có quay vòng. Cộng 31 rồi lấy mặt nạ tương đương trừ 1, mà không bị âm."));
  P(bullet("`reachable` trả lời: _nếu đoạn này vào ở tốc độ đó, nó có kịp phanh xuống `next_entry` ở cuối đoạn không_. Vì gia tốc và phanh đối xứng nên dùng chung một công thức."));
  P(bullet("Ba dòng so sánh lấy **giá trị nhỏ nhất** trong ba ràng buộc: trần do góc, khả năng phanh, và tốc độ được yêu cầu."));
  P(...code([
    "  /* lượt tới */",
    "  uint8_t prev = first;",
    "  i = q_next(first);",
    "  while (i != q_head)",
    "  {",
    "    block_t *p = &queue[prev];",
    "    block_t *b = &queue[i];",
    "    float reachable = speed_after(p->entry_speed, p->accel, p->length_mm);",
    "    if (reachable < b->entry_speed)",
    "      b->entry_speed = reachable;",
    "    prev = i;",
    "    i = q_next(i);",
    "  }",
  ]));
  P(p("Lượt này chỉ **hạ xuống**, không bao giờ nâng lên, vì lượt lùi đã bảo đảm phanh kịp và không được phá vỡ điều đó. Nó sửa tình huống ngược lại: tốc độ vào quá cao so với mức mà đoạn trước có thể đẩy lên."));
  P(h3("Ví dụ số cho dễ hình dung"));
  P(p("Giả sử ba đoạn liên tiếp, mỗi đoạn 1 mm, gia tốc 2000 mm/s², tốc độ yêu cầu 150 mm/s, các góc đều thẳng nên trần góc không giới hạn:"));
  P(table(["Đoạn", "Sau lượt lùi", "Sau lượt tới", "Giải thích"],
    [["1", "63 mm/s", "**0 mm/s**", "đoạn đầu tiên, xuất phát từ đứng yên"],
     ["2", "63 mm/s", "**63 mm/s**", "đoạn 1 dài 1 mm đẩy lên được 63 mm/s"],
     ["3", "63 mm/s", "**89 mm/s**", "đã có đà, nhưng vẫn phải phanh về 0 ở cuối"]],
    [0.7, 1.2, 1.2, 2.9]));
  P(gap());
  P(p("Đoạn 1 bị lượt tới kéo về 0 vì không có đoạn nào trước nó để lấy đà. Đoạn 3 bị lượt lùi giữ ở mức vừa đủ phanh kịp. Chỉ hai lượt quét đơn giản mà ra được một phân bố hợp lý."));

  P(h3("A.4.7 junction_speed"));
  P(...code([
    "  float cos_theta = -(prev_ux * b->ux + prev_uy * b->uy);",
  ]));
  P(...def("Tích vô hướng:", "với hai vector đơn vị, tích vô hướng `u·v = ux·vx + uy·vy` cho ra đúng cosin của góc giữa chúng. Không cần hàm lượng giác, chỉ hai phép nhân và một phép cộng. Dấu trừ ở đầu là để đổi từ góc giữa hai hướng đi sang góc trong của khúc cua."));
  P(table(["Giá trị cos_theta", "Hình dạng", "Xử lý trong code"],
    [["gần +1", "quay đầu 180 độ", "trả về 0, bắt buộc dừng"],
     ["gần −1", "đi thẳng", "trả về nguyên tốc độ yêu cầu"],
     ["ở giữa", "khúc cua", "áp công thức junction deviation"]],
    [1.2, 1.2, 2.6]));
  P(gap());
  P(p("Hai phép so sánh với `0.999999f` không phải để làm đẹp mà để **tránh chia cho số rất nhỏ**. Nếu `sin_half` tiến tới 1 thì mẫu số `1 - sin_half` tiến tới 0 và kết quả vọt lên vô cực. Đây là mẫu phòng vệ bắt buộc mỗi khi có phép chia mà mẫu số do dữ liệu quyết định."));

  P(h3("A.4.8 start_timer_if_idle và vùng loại trừ"));
  P(...code([
    "static void start_timer_if_idle(void)",
    "{",
    "  __disable_irq();",
    "  if (!running && q_head != q_tail)",
    "  {",
    "    running = 1;",
    "    ...khởi động timer...",
    "  }",
    "  __enable_irq();",
    "}",
  ]));
  P(...def("Vùng loại trừ (critical section):", "đoạn code không được phép bị ngắt chen ngang. `__disable_irq()` tắt toàn bộ ngắt, `__enable_irq()` bật lại. Mọi thứ nằm giữa hai lệnh đó chạy liền một mạch."));
  P(p("Vì sao chỗ này cần: hãy tưởng tượng không có nó. Vòng lặp chính đọc `running` thấy bằng 0 nên định khởi động timer. Ngay lúc đó ISR chạy xong đoạn cuối và tắt timer, đặt `running = 0`. Rồi vòng lặp chính khởi động timer trong khi trạng thái đã thay đổi. Kết quả là timer chạy mà không có đoạn nào, hoặc tệ hơn là hai luồng cùng cấu hình timer."));
  P(...note("Quy tắc dùng:", "vùng loại trừ phải **ngắn nhất có thể**, vì trong lúc đó mọi ngắt khác đều bị trễ. Ở đây chỉ gồm vài lệnh ghi thanh ghi, khoảng vài chục nano giây."));

  P(h3("A.4.9 stepper_move_xy, chia thành sáu khối"));
  P(p("Hàm công khai quan trọng nhất. Đọc theo thứ tự từng khối:"));
  P(...code([
    "// Khối 1: từ chối sớm",
    "if (speed_mm_s <= 0.0f)        return STEPPER_ERROR;",
    "uint8_t next = q_next(q_head);",
    "if (next == q_tail)            return STEPPER_BUSY;",
  ]));
  P(p("Mẫu **guard clause**: kiểm tra các điều kiện xấu trước và thoát ngay, thay vì bọc toàn bộ thân hàm trong một khối `if` lồng nhau. Code đọc dễ hơn hẳn."));
  P(...code([
    "// Khối 2: động học, tính từ đích tuyệt đối",
    "float tx = pos_x_mm + dx_mm;",
    "float ty = pos_y_mm + dy_mm;",
    "int32_t target_a = lroundf((tx + ty) * STEPS_PER_MM);",
    "int32_t target_b = lroundf((tx - ty) * STEPS_PER_MM);",
    "int32_t da = target_a - plan_a;",
    "int32_t db = target_b - plan_b;",
  ]));
  P(p("Điểm cốt lõi đã nói ở mục 6.5: làm tròn **vị trí đích**, rồi mới trừ, chứ không làm tròn quãng đường. Nhờ vậy sai số làm tròn của đoạn này không truyền sang đoạn sau."));
  P(...code([
    "// Khối 3: trường hợp đặc biệt, quãng đường ngắn hơn một bước",
    "int32_t n = (abs_a > abs_b) ? abs_a : abs_b;",
    "if (n == 0) {",
    "  pos_x_mm = tx;  pos_y_mm = ty;",
    "  return STEPPER_OK;",
    "}",
  ]));
  P(p("Quan trọng là **vẫn cập nhật vị trí** rồi mới trả về. Nếu bỏ qua luôn, nhiều lệnh siêu ngắn liên tiếp sẽ cộng dồn thành một sai lệch thấy được. Cách làm này giữ lại phần lẻ cho lệnh sau, lại đúng tinh thần không vứt phần dư."));
  P(...code([
    "// Khối 4: chặn tốc độ theo khả năng motor",
    "float ticks_per_mm = (float)n / length_mm;",
    "float v_cap = (TIM_TICK_HZ / (float)MIN_PERIOD_US) / ticks_per_mm;",
    "if (speed_mm_s > v_cap) return STEPPER_ERROR;",
  ]));
  P(p("`TIM_TICK_HZ / MIN_PERIOD_US` cho ra số nhịp tối đa mỗi giây, ở đây là 40000. Chia tiếp cho `ticks_per_mm` ra tốc độ tối đa của đầu in **theo đúng hướng đang đi**. Nhờ vậy giới hạn tự động chặt hơn ở hướng chéo, không phải viết trường hợp riêng."));
  P(...code([
    "// Khối 5: điền vào ô trống của hàng đợi",
    "block_t *b = &queue[q_head];",
    "b->steps_a = abs_a;  ...  b->nominal_speed = speed_mm_s;",
    "float jv = junction_speed(b);",
    "if (jv > speed_mm_s) jv = speed_mm_s;",
    "b->max_entry_speed = jv;",
    "b->entry_speed = jv;",
  ]));
  P(p("Chú ý thứ tự: struct được điền **đầy đủ trước**, vì `junction_speed` cần đọc `b->ux` và `b->accel` của chính đoạn này."));
  P(...code([
    "// Khối 6: chốt sổ và khởi động",
    "plan_a = target_a;  plan_b = target_b;",
    "pos_x_mm = tx;      pos_y_mm = ty;",
    "prev_ux = b->ux;    prev_uy = b->uy;   have_prev = 1;",
    "",
    "q_head = next;        // ← kể từ dòng này, ISR mới nhìn thấy đoạn mới",
    "recalculate();",
    "start_timer_if_idle();",
  ]));
  P(...note("Dòng quan trọng nhất cả hàm:", "`q_head = next`. Trước dòng đó, ISR hoàn toàn không biết có đoạn mới, vì với nó hàng đợi vẫn kết thúc ở `q_head` cũ. Sau dòng đó, đoạn mới có hiệu lực ngay lập tức. Phải đặt sau khi struct đã điền xong, nếu đặt trước thì ISR có thể nạp một đoạn chưa hoàn chỉnh. Đây là một **hàng rào thứ tự** bằng quy ước, và là lý do tại sao hàng đợi này an toàn mà không cần khoá."));

  P(h3("A.4.10 load_block: chỗ đổi đơn vị"));
  P(p("Hàm này chạy **trong ngắt**, nhưng chỉ một lần cho mỗi đoạn. Đây là nơi duy nhất trong ISR có phép tính số thực, và điều đó chấp nhận được vì nó không chạy mỗi bước."));
  P(...code([
    "uint8_t nxt = q_next(q_tail);",
    "float exit_speed = (nxt == q_head) ? 0.0f : queue[nxt].entry_speed;",
  ]));
  P(p("Tốc độ ra của đoạn này chính là **tốc độ vào của đoạn kế tiếp**. Nếu không còn đoạn nào thì phải dừng hẳn. Chính hai dòng này nối các đoạn lại thành một chuyển động liền mạch."));
  P(...code([
    "float tpm = (float)b->n / b->length_mm;        // nhịp trên mỗi mm",
    "float v_entry = b->entry_speed   * tpm;        // tất cả đổi sang nhịp/giây",
    "float v_nom   = b->nominal_speed * tpm;",
    "float v_exit  = exit_speed       * tpm;",
    "float a       = b->accel         * tpm;",
  ]));
  P(p("Năm dòng này là **toàn bộ ranh giới giữa hai thế giới**. Phía trên chúng là milimét, phía dưới là nhịp timer. Nếu sau này có lỗi kiểu tốc độ sai hệ số, hãy tìm ở đây trước."));
  P(...code([
    "float up   = (v_nom*v_nom - v_entry*v_entry) / (2.0f * a);",
    "float down = (v_nom*v_nom - v_exit *v_exit ) / (2.0f * a);",
    "if (up < 0.0f)   up = 0.0f;",
    "if (down < 0.0f) down = 0.0f;",
  ]));
  P(p("Lại là công thức s = (v² − v₀²)/2a. Hai dòng kẹp về 0 xử lý trường hợp tốc độ vào **đã cao hơn** tốc độ yêu cầu, khi đó không có pha tăng tốc nào cả."));
  P(...code([
    "if (up + down > (float)b->n) {       // không đủ chỗ cho cả hai dốc",
    "  float peak = (2.0f*a*b->n + v_exit*v_exit - v_entry*v_entry) / (4.0f*a);",
    "  up = peak;  down = b->n - peak;",
    "}",
  ]));
  P(p("Công thức `peak` giải phương trình _hai dốc gặp nhau ở đâu_. Dẫn ra bằng cách cho quãng tăng tốc cộng quãng giảm tốc bằng đúng n rồi giải tìm tốc độ đỉnh."));
  P(...code([
    "cruise_from = b->n - (int32_t)up;",
    "decel_from  = (int32_t)down;",
    "i_offset = (int32_t)((v_entry*v_entry) / (2.0f*a));",
    "j_offset = (int32_t)((v_exit *v_exit ) / (2.0f*a));",
    "c     = period_of(v_entry);",
    "c_min = period_of(v_nom);",
  ]));
  P(p("Sáu dòng này là **toàn bộ kết quả** mà ISR sẽ dùng cho hàng nghìn nhịp tiếp theo. Tất cả đều là số nguyên. Từ đây tới hết đoạn, không còn phép tính số thực nào nữa."));

  P(h3("A.4.11 stepper_tim2_isr: hàm chạy nhiều nhất"));
  P(p("Hàm này chạy tới hơn ba mươi nghìn lần mỗi giây, nên đáng đọc kỹ từng dòng."));
  P(...code([
    "uint32_t sr = TIM2->SR;          // đọc cờ MỘT lần vào biến cục bộ",
  ]));
  P(p("Vì sao không đọc `TIM2->SR` nhiều lần: mỗi lần đọc một thanh ghi ngoại vi tốn vài chu kỳ bus, và giá trị có thể thay đổi giữa hai lần đọc. Chụp một lần rồi dùng bản sao là vừa nhanh vừa nhất quán."));
  P(...code([
    "if (sr & TIM_SR_CC1IF) {",
    "  TIM2->SR = ~TIM_SR_CC1IF;      // xoá cờ",
    "  hạ cả hai chân STEP",
    "  if (stopping) { stopping = 0; timer_off(); return; }",
    "}",
  ]));
  P(...note("Vì sao xoá cờ bằng phép gán chứ không phải &= ~:", "các bit trong thanh ghi SR thuộc loại _ghi 0 để xoá_. Ghi 1 vào một bit thì bit đó **không đổi**, ghi 0 thì nó bị xoá. Vậy `TIM2->SR = ~TIM_SR_CC1IF` ghi 0 vào đúng bit CC1IF và ghi 1 vào mọi bit còn lại, tức xoá đúng một cờ và giữ nguyên các cờ khác. Dùng `&=` ở đây là sai vì nó đọc trước rồi ghi lại, có thể vô tình xoá mất một cờ vừa mới được phần cứng bật lên giữa chừng."));
  P(...code([
    "if (sr & TIM_SR_UIF) {",
    "  TIM2->SR = ~TIM_SR_UIF;",
    "  if (events_left == 0) {",
    "    if (!load_block()) { timer_off(); return; }",
    "    return;                      // xung đầu tiên để chu kỳ sau",
    "  }",
  ]));
  P(p("Chú ý hai lệnh `return` liền nhau nhưng ý nghĩa khác hẳn. Cái thứ nhất: hết việc, tắt máy. Cái thứ hai: vừa nạp đoạn mới xong, lần ngắt này **không phát xung nào**, dành trọn một chu kỳ để chân DIR ổn định trước khi xung đầu tiên xuất hiện. Một chu kỳ ở đây ít nhất là 25 µs, dư sức cho yêu cầu của driver."));
  P(...code([
    "  err_a += steps_a;",
    "  err_b += steps_b;",
    "  if (err_a >= event_count) { err_a -= event_count;",
    "                              A_STEP_PORT->BSRR = A_STEP_PIN;",
    "                              pos_a += dir_a; }",
    "  if (err_b >= event_count) { ...tương tự... }",
    "  events_left--;",
  ]));
  P(p("Phần Bresenham, đúng như mô tả ở chương 6. Để ý `pos_a += dir_a`: vì `dir_a` chỉ nhận +1 hoặc −1 nên một phép cộng lo được cả hai chiều, không cần rẽ nhánh."));
  P(...code([
    "  if (events_left == 0) {",
    "    q_tail = q_next(q_tail);        // trả ô cho planner",
    "    if (!load_block()) stopping = 1;",
    "    return;",
    "  }",
  ]));
  P(p("Dòng `q_tail = q_next(q_tail)` là lúc ô trong hàng đợi được **giải phóng** cho planner ghi đè. Đặt đúng chỗ này, sau khi đoạn đã chạy xong hoàn toàn."));
  P(p("Nếu không còn đoạn nào thì chỉ đặt cờ `stopping` chứ không tắt timer ngay, vì xung vừa phát ra còn đang ở mức cao, phải chờ ngắt so sánh hạ nó xuống."));
  P(...code([
    "  if (events_left > cruise_from) { ...tăng tốc... }",
    "  else if (events_left <= decel_from) { ...giảm tốc... }",
    "  else { c = c_min; rest = 0; }",
    "  TIM2->ARR = c - 1U;",
  ]));
  P(p("Ba nhánh profile tốc độ, và dòng cuối ghi chu kỳ cho bước kế tiếp. Nhờ cơ chế preload của ARR, giá trị này tự động có hiệu lực đúng lúc."));

  P(h3("A.4.12 stepper_abort: dừng khẩn"));
  P(...code([
    "__disable_irq();",
    "TIM2->CR1  &= ~TIM_CR1_CEN;        // tắt bộ đếm",
    "TIM2->DIER &= ~(TIM_DIER_UIE | TIM_DIER_CC1IE);",
    "running = 0;  stopping = 0;  events_left = 0;",
    "q_head = q_tail;                   // vứt hết hàng đợi",
    "__enable_irq();",
    "",
    "hạ hai chân STEP",
    "plan_a = pos_a;   plan_b = pos_b;  // planner đi theo thực tế",
    "pos_x_mm = (pos_a + pos_b) / (2 * STEPS_PER_MM);",
    "pos_y_mm = (pos_a - pos_b) / (2 * STEPS_PER_MM);",
    "have_prev = 0;",
    "mc_set_position(pos_x_mm, pos_y_mm);",
  ]));
  P(p("Nửa sau mới là phần tinh tế. Dừng khẩn giữa chừng thì motor nằm ở một vị trí **không phải** đích của đoạn đang chạy. Nếu để nguyên, planner vẫn tin đầu in đã tới đích, và lệnh tiếp theo sẽ tính sai quãng đường, gây một cú nhảy lớn."));
  P(p("Nên phải làm điều ngược lại thường lệ: **lấy vị trí thật của motor làm chuẩn**, rồi dùng động học thuận tính ngược ra toạ độ XY, rồi báo cho cả `motion_control` biết. `have_prev = 0` để đoạn kế tiếp coi như bắt đầu từ đứng yên, không tính góc nối với đoạn đã bị huỷ."));

  // ================= A.5 =================
  P(brk(), h2("A.5 tmc2209.c"));
  P(h3("Kiểm tra timeout theo baud"));
  P(...code([
    "static uint32_t frame_timeout_ms(uint8_t bytes)",
    "{",
    "  uint32_t baud = TMC_UART->Init.BaudRate;",
    "  if (baud == 0U) baud = 9600U;",
    "  return ((uint32_t)bytes * 10U * 1000U) / baud + TMC_TIMEOUT_MARGIN_MS;",
    "}",
  ]));
  P(p("Một byte UART chiếm 10 bit trên đường truyền: một bit khởi đầu, tám bit dữ liệu, một bit kết thúc. Nhân số byte với 10 ra tổng số bit, nhân 1000 để đổi sang mili giây, chia cho baud ra thời gian. Cộng thêm biên dự phòng cho khoảng chờ trả lời và sai số làm tròn của đồng hồ hệ thống."));
  P(p("Hàm đọc baud **từ chính cấu hình đang chạy** chứ không dùng hằng số. Nhờ vậy đổi baud trong CubeMX thì code tự thích ứng. Đây là cách sửa cho lỗi số 3 trong bảng ở chương 12."));

  P(h3("Khoảng nghỉ giữa hai gói"));
  P(...code([
    "static void bus_gap(void)",
    "{",
    "  uint32_t baud = TMC_UART->Init.BaudRate;",
    "  if (baud == 0U) baud = 9600U;",
    "  HAL_Delay(10U * 1000U / baud + 1U);",
    "}",
  ]));
  P(p("Mười bit, tức một byte, tính ra mili giây rồi cộng một. Datasheet chỉ yêu cầu chờ bốn bit, nhưng vì `HAL_Delay` chỉ có độ phân giải một mili giây nên lấy dư cho chắc. Giá phải trả là vài mili giây cho mỗi lần giao tiếp, chỉ xảy ra lúc khởi động nên không ảnh hưởng gì."));

  P(h3("transfer: gửi rồi nhận cả tiếng vọng"));
  P(...code([
    "__HAL_UART_SEND_REQ(TMC_UART, UART_RXDATA_FLUSH_REQUEST);",
    "__HAL_UART_CLEAR_FLAG(TMC_UART, UART_CLEAR_OREF | ...);",
    "",
    "HAL_UART_Transmit(TMC_UART, tx, tx_len, frame_timeout_ms(tx_len));",
    "HAL_UART_Receive(TMC_UART, buf, total, frame_timeout_ms(total));",
    "bus_gap();",
    "if (memcmp(buf, tx, tx_len) != 0) return TMC2209_ECHO_ERROR;",
    "memcpy(rx, buf + tx_len, rx_len);",
  ]));
  P(p("Trình tự này là kết quả của bốn lần sửa lỗi, mỗi dòng đều có lý do:"));
  P(num("**Xoá bộ đệm và cờ lỗi trước khi gửi.** Cờ lỗi tràn không tự tắt, một lần lỗi cũ sẽ làm hỏng mọi lần sau cho tới khi reset chip."));
  P(num("**Nhận đúng `tx_len + rx_len` byte**, vì tiếng vọng cũng chiếm chỗ. Phần này dựa vào bộ đệm FIFO 16 byte của USART để giữ tiếng vọng trong lúc đang gửi."));
  P(num("**So sánh tiếng vọng với gói đã gửi** bằng `memcmp`. Khớp thì biết đường dây tốt, không khớp là tín hiệu bị méo."));
  P(num("**`bus_gap()` đặt sau khi nhận**, để lần gọi kế tiếp không bị đụng độ với driver."));
  P(...def("memcmp và memcpy:", "hai hàm chuẩn của C. `memcmp(a, b, n)` so sánh n byte và trả về 0 nếu giống hệt. `memcpy(đích, nguồn, n)` chép n byte. Cả hai làm việc trên byte thô, không quan tâm kiểu dữ liệu."));

  // ================= A.6 =================
  P(h2("A.6 gcode.c và motion_control.c"));
  P(h3("Vòng lặp đọc chữ"));
  P(...code([
    "while (*p)",
    "{",
    "  p = skip_space(p);",
    "  if (*p == ';' || *p == '\\0') break;      // chú thích, bỏ phần còn lại",
    "",
    "  char letter = *p++;                      // lấy chữ cái rồi tiến con trỏ",
    "  if (letter >= 'a' && letter <= 'z')",
    "    letter = letter - 'a' + 'A';           // đổi chữ thường thành hoa",
    "",
    "  char *end;",
    "  float value = strtof(p, &end);           // đọc số",
    "  if (end == p) return GCODE_BAD_FORMAT;   // không có số sau chữ cái",
    "  p = end;",
    "}",
  ]));
  P(...def("Con trỏ chạy trên chuỗi:", "`p` trỏ vào ký tự đang xét. `*p` là ký tự đó, `p++` đẩy con trỏ sang ký tự kế tiếp. Chuỗi trong C kết thúc bằng ký tự 0, nên `while (*p)` nghĩa là _chừng nào chưa tới cuối chuỗi_."));
  P(p("Mẹo đổi chữ thường thành hoa: trong bảng mã ASCII, các chữ cái nằm liên tiếp, nên `'c' - 'a'` cho ra thứ tự của chữ đó trong bảng chữ cái, cộng `'A'` vào là ra chữ hoa tương ứng."));
  P(p("`strtof` đọc một số thực từ chuỗi và đồng thời **cho biết nó đã đọc tới đâu** qua tham số `end`. Nếu `end` vẫn bằng `p` nghĩa là không đọc được số nào, tức cú pháp sai."));

  P(h3("Trạng thái modal"));
  P(...code([
    "static uint8_t absolute_mode = 1;",
    "static int8_t  motion_mode = 0;",
    "static float   feed_mm_s = 0.0f;",
  ]));
  P(p("Ba biến này giữ giá trị **giữa các dòng lệnh**, đúng theo đặc tính modal của G-code. Dòng `G1 X10` không ghi tốc độ, nên parser dùng lại `feed_mm_s` của lần trước. Dòng chỉ ghi `X10 Y20` thậm chí không có chữ G, parser dùng lại `motion_mode`."));

  P(h3("mc_arc: chia cung thành dây cung"));
  P(...code([
    "float theta = sqrtf(8.0f * ARC_TOLERANCE_MM / r);",
    "int32_t segments = (int32_t)(fabsf(sweep) / theta) + 1;",
    "if (segments < ARC_MIN_SEGMENTS) segments = ARC_MIN_SEGMENTS;",
    "if (segments > ARC_MAX_SEGMENTS) segments = ARC_MAX_SEGMENTS;",
    "",
    "for (int32_t s = 1; s <= segments; s++) {",
    "  float a = a_start + sweep * (float)s / (float)segments;",
    "  mc_line(cx + r*cosf(a), cy + r*sinf(a), feed);",
    "}",
    "mc_line(x, y, feed);          // chốt đúng điểm đích đã yêu cầu",
  ]));
  P(p("Hai dòng kẹp số đoạn là phòng vệ: bán kính rất lớn có thể sinh ra hàng vạn đoạn và làm nghẽn hàng đợi, bán kính rất nhỏ có thể ra một đoạn duy nhất và trông như gãy góc."));
  P(p("Dòng cuối cùng quan trọng: do làm tròn số thực, điểm cuối tính từ góc có thể lệch vài micromét so với toạ độ người dùng yêu cầu. Thêm một đoạn đi thẳng tới đúng điểm đích để sai số không tích luỹ qua nhiều cung liên tiếp."));

  // ================= A.7 =================
  P(h2("A.7 comms.c"));
  P(h3("Ký tự thời gian thực xử lý ngay trong ngắt"));
  P(...code([
    "void comms_rx(const uint8_t *data, uint32_t len)",
    "{",
    "  for (uint32_t i = 0; i < len; i++) {",
    "    uint8_t ch = data[i];",
    "    if (ch == '?') { want_status = 1; continue; }",
    "    if (ch == '!' || ch == 0x18) {",
    "      stepper_abort();  alarm = 1;  rx_head = rx_tail;  continue;",
    "    }",
    "    ...còn lại thì xếp vào hàng đợi byte...",
    "  }",
    "}",
  ]));
  P(p("Hàm này được gọi **từ ngắt USB**, nên phải rất ngắn. Nhưng lệnh dừng khẩn vẫn gọi thẳng `stepper_abort()` ngay tại đây, vì nếu xếp hàng thì phải chờ xử lý hết các dòng lệnh phía trước, mà như vậy thì nút dừng khẩn mất hết ý nghĩa."));
  P(p("Dòng `rx_head = rx_tail` vứt sạch mọi byte đang chờ xử lý. Sau khi dừng khẩn, các lệnh cũ không còn ý nghĩa nữa."));
  P(p("Ngược lại, dấu hỏi chỉ **đặt một cờ** chứ không in gì, vì gửi dữ liệu qua USB mất thời gian và không được làm trong ngắt. Vòng lặp chính thấy cờ thì mới soạn và gửi báo cáo."));

  P(h3("Mỗi lần chỉ xử lý một dòng"));
  P(...code([
    "if (ch == '\\n' || ch == '\\r') {",
    "  ...chạy dòng lệnh, trả ok hoặc error...",
    "  return;              // ← thoát hẳn, không xử lý tiếp dòng sau",
    "}",
  ]));
  P(p("Lệnh `return` này có chủ ý. `gcode_line()` có thể chặn khá lâu khi hàng đợi đầy, vì nó phải chờ có chỗ. Trả về sau mỗi dòng cho phép vòng lặp chính quay lại làm việc khác, đặc biệt là trả lời lệnh hỏi trạng thái của máy tính."));

  // ================= A.8 =================
  P(h2("A.8 main.c: thứ tự khởi tạo"));
  P(...code([
    "MPU_Config();              // cấu hình bảo vệ bộ nhớ, CubeMX sinh",
    "HAL_Init();                // khởi tạo thư viện và đồng hồ hệ thống",
    "SystemClock_Config();      // HSE 25 MHz → PLL → 480 MHz",
    "MX_GPIO_Init();            // chân vào ra",
    "MX_USART3_UART_Init();     // UART cho driver",
    "MX_TIM2_Init();            // timer phát xung",
    "MX_USB_DEVICE_Init();      // USB",
    "",
    "HAL_Delay(100);            // chờ driver lên nguồn",
    "tmc_setup();               // cấu hình hai driver qua UART",
    "stepper_init();            // chân về 0, hàng đợi rỗng",
    "gcode_init();",
    "comms_init();",
  ]));
  P(p("Thứ tự này **không tuỳ tiện**, mỗi bước phụ thuộc bước trước:"));
  P(bullet("Clock phải xong trước mọi thứ, vì tính toán tốc độ UART và timer đều dựa vào tần số hệ thống."));
  P(bullet("UART phải xong trước `tmc_setup`, vì hàm đó nói chuyện qua UART."));
  P(bullet("`HAL_Delay(100)` chờ nguồn 24V của driver ổn định. Không có nó, lệnh cấu hình đầu tiên có thể gửi lúc driver chưa sẵn sàng."));
  P(bullet("`stepper_init` phải sau `MX_TIM2_Init`, vì nó ghi vào thanh ghi của TIM2."));
  P(...note("Một lỗi dễ mắc:", "nếu đổi chỗ `tmc_setup()` lên trước `MX_USART3_UART_Init()`, code vẫn biên dịch bình thường nhưng chạy sẽ treo hoặc trả về lỗi timeout, vì ngoại vi UART chưa được bật. Đây là loại lỗi mà trình biên dịch không bao giờ bắt được."));

  // ================= A.9 =================
  P(brk(), h2("A.9 Bảng tra: biến nào, ai ghi, ai đọc"));
  P(p("Khi sửa code, bảng này giúp trả lời nhanh câu hỏi _đụng vào biến này có an toàn không_."));
  P(table(["Biến", "Ai ghi", "Ai đọc", "volatile"],
    [["q_head", "vòng lặp chính", "cả hai", "có"],
     ["q_tail", "ISR", "cả hai", "có"],
     ["queue[i] khi i chưa tới q_head", "vòng lặp chính", "chỉ vòng lặp chính", "không"],
     ["queue[i].entry_speed đã xếp hàng", "vòng lặp chính", "cả hai", "không, được bảo vệ bằng quy ước"],
     ["pos_a, pos_b", "ISR", "cả hai", "có"],
     ["plan_a, plan_b", "vòng lặp chính", "chỉ vòng lặp chính", "không"],
     ["c, rest, err_a, err_b", "ISR", "chỉ ISR", "có"],
     ["events_left", "ISR", "cả hai", "có"],
     ["running, stopping", "cả hai", "cả hai", "có, và có vùng loại trừ"]],
    [2.2, 1.3, 1.3, 1.8]));
  P(gap());
  P(...note("Dòng đáng chú ý nhất:", "`entry_speed` của các đoạn đã xếp hàng bị vòng lặp chính sửa trong khi ISR có thể đang đọc đoạn kế tiếp. Không có khoá nào ở đây. An toàn là nhờ quy ước: `recalculate()` không bao giờ đụng vào đoạn ở `q_tail` khi timer đang chạy. Nếu sau này ai đó sửa quy ước này mà không nhận ra, lỗi sinh ra sẽ cực kỳ khó tái hiện vì nó phụ thuộc thời điểm."));

  // ================= A.10 =================
  P(h2("A.10 Bài tập đọc code"));
  P(p("Tự trả lời trước khi xem đáp án. Nếu trả lời đúng cả sáu thì bạn đã nắm được code."));
  P(num("Vì sao `pos_x_mm` không cần `volatile` còn `pos_a` thì cần?"));
  P(num("Điều gì xảy ra nếu xoá dòng `q_head = next;` trong `stepper_move_xy` và đặt nó lên ngay sau `block_t *b = &queue[q_head];`?"));
  P(num("Vì sao `recalculate()` bỏ qua đoạn ở `q_tail` khi `running` đang bật?"));
  P(num("Trong ISR, vì sao sau khi nạp đoạn mới lại `return` ngay mà không phát xung luôn?"));
  P(num("Nếu đổi `QUEUE_SIZE` từ 32 thành 30 thì chuyện gì xảy ra?"));
  P(num("Vì sao `stepper_abort()` phải đặt lại `plan_a` và `pos_x_mm`?"));
  P(h3("Đáp án"));
  P(num("`pos_x_mm` chỉ được vòng lặp chính đọc và ghi, không ai khác đụng tới nên trình biên dịch tối ưu thế nào cũng đúng. `pos_a` bị ISR ghi, nên nếu không có `volatile` thì vòng lặp chính có thể đọc ra một giá trị cũ đã nằm sẵn trong thanh ghi CPU."));
  P(num("ISR sẽ có thể nạp một đoạn **chưa điền xong**, với số bước và tốc độ còn là rác của đoạn cũ. Lỗi này xảy ra hiếm, chỉ khi ngắt rơi đúng vào khe giữa hai lệnh, nên cực khó tái hiện và càng khó tìm."));
  P(num("Vì đoạn đó đã được `load_block()` chuyển thành các con số nguyên và đường dốc của nó đang chạy. Sửa `entry_speed` lúc này không có tác dụng gì với chuyển động hiện tại, nhưng lại làm sai tốc độ ra mà đoạn kế tiếp dựa vào."));
  P(num("Để dành trọn một chu kỳ timer cho chân DIR ổn định trước xung đầu tiên. Nếu đổi chiều rồi phát xung ngay, driver có thể hiểu nhầm chiều của bước đó."));
  P(num("`QUEUE_MASK` sẽ bằng 29, mà 29 ở dạng nhị phân là 11101, không phải một dãy toàn số 1. Phép `và` với mặt nạ đó không còn tương đương phép chia lấy dư, nên chỉ số hàng đợi sẽ nhảy lung tung và ghi đè lẫn nhau. Đây chính là lý do kích thước **bắt buộc** phải là luỹ thừa của 2."));
  P(num("Vì khi dừng giữa chừng, motor không nằm ở đích của đoạn đang chạy. Planner thì vẫn tin là đã tới đích. Không đồng bộ lại thì lệnh kế tiếp tính quãng đường từ một điểm sai, và đầu in sẽ nhảy một đoạn đúng bằng phần còn thiếu."));

  return out;
};
