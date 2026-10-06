# Checklist dự án

Cập nhật: 2026-10-06

## Phần cứng

- [x] Chọn linh kiện chính: FK743M2-IIT6, 2 × TMC2209, 3 × A4988, IRLB3034, TC4427
- [x] Rút kinh nghiệm từ SKR2, Octopus Pro, Duet2, Prusa Buddy (xem `01_kinh_nghiem_tu_mach_tham_khao.md`)
- [x] Sơ đồ KiCad v0.1, 8 trang, sinh bằng `hardware/tools/gen_schematic.py`
- [x] Bo mẫu hàn tay, chạy được UART và hai motor
- [ ] Rà lại sơ đồ sau khi bo mẫu chạy ổn
- [ ] Vẽ PCB
- [ ] Đặt gia công và ráp bo thật

### Bài học từ bo mẫu, phải áp vào PCB

- **VIO của TMC2209 lấy 3.3V**, cùng mức với MCU. Cấp 5V thì ngưỡng mức 1 thành 3.5V, MCU xuất 3.3V không đủ.
- **Điện trở nối TX vào bus UART là 1k.** Thử 10k thì sườn tín hiệu chậm, phản hồi của driver về bị lệch bit.
- **Chân PDN_UART trên module StepStick có thể để hở**, phải hàn pad thì mới dùng UART được. Đây là thứ làm mất nhiều thời gian nhất khi dựng bo mẫu.
- **Dây SWD phải ngắn và xoắn với GND.** Chạy motor ở 80 mm/s từng làm đứt kết nối SWD và ST-Link rớt khỏi USB.

## Firmware

### Bước 0 — TMC2209 qua UART ✅

- [x] Driver UART một dây, xử lý tiếng vọng, CRC theo datasheet
- [x] Cấu hình GCONF (`pdn_disable`, `mstep_reg_select`, `i_scale_analog`)
- [x] Đặt vi bước 1/16 qua CHOPCONF.MRES, bật `intpol`
- [x] SENDDELAY = 2 vì có hai driver chung bus
- [x] Xác nhận lệnh ghi bằng IFCNT, kiểm tra chip bằng IOIN VERSION = 0x21
- [x] Timeout và khoảng nghỉ giữa gói tự tính theo baud
- [ ] Tự phát hiện driver bị reset (GSTAT bit 0) rồi nạp lại cấu hình
- [ ] Đặt dòng bằng phần mềm qua IHOLD_IRUN, thay cho biến trở VREF
- [ ] Chuyển sang SpreadCycle hoặc đặt TPWMTHRS khi chạy nhanh

### Bước 1 — Một motor bằng timer ✅

- [x] TIM2 ở 1 MHz, ngắt update
- [x] `stepper_move_a` với số bước và tốc độ
- [x] Đếm vị trí tuyệt đối, tự dừng khi hết bước
- [x] LED vẫn nháy khi motor quay, chứng tỏ CPU không bị chặn

### Bước 2 — Hai motor, Bresenham, CoreXY ✅

- [x] `stepper_move_xy(dx, dy, speed)` với phép biến đổi A = X+Y, B = X−Y
- [x] Bresenham trên một timer chung, hai motor cùng bắt đầu và cùng kết thúc
- [x] Chu kỳ tính theo chiều dài XY, không theo AB
- [x] Tính số bước từ đích tuyệt đối để không tích luỹ sai số
- [x] Bỏ vòng chờ trong ngắt, dùng compare channel CC1 hạ chân STEP
- [x] Ép sự kiện update khi nạp ARR vì ARR có preload
- [x] Thử thật: đường thẳng, hình vuông, hình tròn 72 đoạn, tất cả về đúng điểm xuất phát
- [ ] Đo lại tốc độ tối đa sau khi sửa ISR (lần trước đứt SWD ở 80 mm/s)

### Bước 3 — Gia tốc hình thang ✅

- [x] Mỗi block có 3 pha: tăng tốc, chạy đều, giảm tốc
- [x] Tính profile ngoài ngắt, trong ngắt chỉ còn truy hồi số nguyên AVR446
- [x] Biến dư giữ phần lẻ của phép chia nên sai số không tích luỹ
- [x] Đoạn ngắn tự chuyển thành profile tam giác
- [x] Trần 40 kHz mỗi motor, tốc độ vô lý bị trả về `STEPPER_ERROR`
- [x] `stepper_set_accel()`, mặc định 2000 mm/s²
- [x] Chạy thật 100 mm ở 150 mm/s hết 728 ms, khớp mô phỏng

### Bước 4 — Nhận lệnh ⬜ (việc tiếp theo)

- [ ] Parser G-code tối giản: `G0`, `G1` với X, Y, F, rồi `G90`, `G91`
- [ ] Giao tiếp qua USB CDC hoặc UART
- [ ] `G2`, `G3`: chia cung tròn thành đoạn thẳng, giống `mc_arc` của grbl
- [ ] Tách lớp `motion_control` ra khỏi `stepper`

### Bước 5 — Hàng đợi và lookahead ✅

- [x] Ring buffer 16 block, producer là main loop, consumer là ngắt
- [x] Junction deviation kiểu grbl, `stepper_set_junction_deviation()`, mặc định 0.05 mm
- [x] Quét lùi rồi quét tới, không đụng block đang chạy
- [x] Nạp block kế tiếp ngay trong ngắt, timer không dừng giữa hai block
- [x] `i_offset`, `j_offset` nối liền đường dốc qua ranh giới block
- [x] Chạy thật: 100 mm chia 20 đoạn hết **728 ms**, bằng đúng khi đi một đoạn liền
- [ ] Đo lại trên đường tròn 72 dây cung (mô phỏng cho thấy nhanh hơn 3.6 lần)

### Sau đó ⬜

- [ ] Homing với 3 cảm biến tiệm cận, Z kiêm dò bàn
- [ ] Trục Z và đầu đùn trên A4988
- [ ] Đọc nhiệt độ NTC, vòng điều khiển PID cho hotend và bàn
- [ ] Điều khiển quạt
- [ ] Đọc file từ thẻ microSD
- [ ] Input shaping
- [ ] Chuyển phần planner sang SBC (dự tính xa)

## Công cụ và tài liệu

- [x] Build bằng CMake và Ninja
- [x] Debug VS Code với ST-Link qua OpenOCD, bật Live Watch
- [x] `debug/tmc.gdb`: lệnh `tmc`, `bus`, `reinit`, `trap`
- [x] `tools/flash_run.sh`: nạp và chạy thử trong một lệnh
- [x] Git repo, đẩy lên GitHub
- [x] `README.md`, `docs/timer.md`, `docs/checklist.md`
- [ ] Tài liệu về giao thức TMC2209 và những lỗi đã gặp
- [ ] Ảnh chụp bo mẫu và sơ đồ đấu dây

## Việc còn treo

1. **Tốc độ tối đa chưa đo lại.** Lần thử trước đứt SWD ở 80 mm/s, chưa rõ là nhiễu hay MCU reset. Chạy `NOFLASH=1 ./tools/flash_run.sh 40 0 80` rồi xem LED còn nháy không.
2. **Baud UART đang để 9600.** Đã thử thật ở 115200 và 250000 đều tốt, nên chỉnh CubeMX về 115200.
3. **`step_test_speed` trong `main.c` đang là 2000**, đơn vị mm/s nên sẽ trả về `STEPPER_ERROR`. Giá trị hợp lý là 20 tới 60.
4. **`HAL_UART_Init()` tắt chế độ FIFO.** Nếu đổi baud lúc chạy thì phải gọi lại `HAL_UARTEx_EnableFifoMode()`, nếu không tiếng vọng chỉ về được 1 byte.
