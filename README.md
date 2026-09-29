# CoreXY Printer

Bo điều khiển máy in 3D CoreXY và firmware tự viết cho nó. Không dùng Marlin, Klipper hay RepRapFirmware — toàn bộ từ parser tới bộ phát xung đều viết tay, chạy trên một MCU duy nhất.

## Phần cứng

| Thành phần | Lựa chọn |
|---|---|
| MCU | STM32H743IIT6, bo lõi FANKE FK743M2-IIT6 (480 MHz, HSE 25 MHz) |
| Driver X/Y | 2 × TMC2209, điều khiển qua UART một dây |
| Driver Z, E | 3 × A4988 (Z1, Z2, E) |
| Nguồn động lực | 24V |
| Công tắc hành trình | 3 cảm biến tiệm cận NPN, cách ly bằng PC817, Z kiêm dò bàn |
| MOSFET gia nhiệt | IRLB3034PbF, lái bằng TC4427 |

**Cơ khí:** đai GT2, puly 20 răng (40 mm mỗi vòng), vi bước 1/16 có nội suy, tức **80 bước/mm**.

## Cấu trúc thư mục

```
hardware/corexy_board/   sơ đồ KiCad 8 trang, BOM
hardware/tools/          script sinh và kiểm tra sơ đồ
software/CoreXY/         firmware STM32 (CubeMX + CMake)
  module/                code tự viết: tmc2209, stepper
  Core/                  code CubeMX sinh ra
  tools/flash_run.sh     nạp và chạy thử trong một lệnh
  debug/tmc.gdb          lệnh gdb hỗ trợ soi driver
docs/                    tài liệu dự án
```

Phần tự viết nằm hết trong `software/CoreXY/module/`. Mọi thứ khác trong `Core/` là do CubeMX sinh, chỉ sửa trong các vùng `USER CODE`.

## Sơ đồ chân chính

| Tín hiệu | Chân | Ghi chú |
|---|---|---|
| Motor A STEP / DIR | PD3 / PD4 | địa chỉ UART 0 (MS1 = 0, MS2 = 0) |
| Motor B STEP / DIR | PG9 / PG10 | địa chỉ UART 1 (MS1 = 1, MS2 = 0) |
| EN chung A + B | PA15 | mức thấp là bật |
| TMC UART | PB10 (TX qua 1k) + PB11 (RX) | USART3, một dây chung, có tiếng vọng |
| DIAG A / B | PD7 / PG11 | chưa dùng |
| LED báo sống | PH7 | nháy trong SysTick |

**Lưu ý:** MS1 và MS2 dùng làm địa chỉ UART, nên **vi bước phải cài qua UART**, không cài bằng chân được. Xem [docs/timer.md](docs/timer.md) và phần TMC2209 trong `module/tmc2209.c`.

## Build và nạp

```bash
cd software/CoreXY
cmake -S . -B build/Debug -G Ninja -DCMAKE_BUILD_TYPE=Debug   # lần đầu
cmake --build build/Debug
```

Nạp bằng OpenOCD với ST-Link:
```bash
openocd -f interface/stlink.cfg -f target/stm32h7x.cfg \
  -c "program build/Debug/CoreXY.elf verify reset" -c shutdown
```

Nạp rồi chạy thử một đoạn thẳng trong một lệnh:
```bash
./tools/flash_run.sh 20 0 20      # dx mm, dy mm, tốc độ mm/s
NOFLASH=1 ./tools/flash_run.sh 40 0 60
```

Debug trong VS Code: bấm F5, chọn **ST-Link (CoreXY)**. Live Watch đã bật sẵn, xem được biến trong lúc chip đang chạy.

## Tình trạng

| Phần | Tình trạng |
|---|---|
| Sơ đồ KiCad | Xong bản v0.1, chưa vẽ PCB |
| Cấu hình TMC2209 qua UART | Chạy thật, cả 2 driver |
| Phát xung một motor bằng timer | Xong |
| Hai motor, Bresenham, động học CoreXY | Xong, đã vẽ được hình vuông và hình tròn |
| Gia tốc hình thang | Chưa |
| Parser G-code | Chưa |
| Lookahead | Chưa |
| Homing, nhiệt độ, quạt | Chưa |

Chi tiết trong [docs/checklist.md](docs/checklist.md).

## Tài liệu

- [docs/timer.md](docs/timer.md) — bộ phát xung: timer, ngắt, Bresenham, ngân sách CPU.
- [docs/checklist.md](docs/checklist.md) — việc đã xong và việc còn lại.
- [docs/01_kinh_nghiem_tu_mach_tham_khao.md](docs/01_kinh_nghiem_tu_mach_tham_khao.md) — rút kinh nghiệm từ SKR2, Octopus Pro, Duet2, Prusa Buddy.

## Tham khảo

Đọc để học cách làm, không chép code: **grbl** (`planner.c`, `stepper.c`, `motion_control.c`), **grblHAL** (bản grbl có HAL, hỗ trợ STM32H7), **Marlin** (`planner.cpp`, `stepper.cpp`), **Klipper** (`kinematics/corexy.py`, `chelper/kin_corexy.c`), và app note **Atmel AVR446** về profile tốc độ động cơ bước.
