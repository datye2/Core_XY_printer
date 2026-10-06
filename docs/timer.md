# Bộ phát xung: timer, ngắt và Bresenham

Tài liệu này mô tả cách `module/stepper.c` biến một lệnh "đi từ đây tới kia" thành xung STEP/DIR cho hai motor CoreXY.

## 1. Động học CoreXY

Trên CoreXY không có motor X và motor Y. Hai motor A và B cùng kéo đầu in, mỗi motor phụ trách một đường chéo 45°.

```
ΔA = ΔX + ΔY          ΔX = (ΔA + ΔB) / 2
ΔB = ΔX − ΔY          ΔY = (ΔA − ΔB) / 2
```

Hệ quả:

| Đầu in đi | Motor A | Motor B |
|---|---|---|
| +X | quay | quay cùng chiều |
| +Y | quay | quay ngược chiều |
| Chéo ↗ | quay gấp đôi | **đứng yên** |
| Chéo ↘ | **đứng yên** | quay gấp đôi |

Khi đi chéo, motor phải quay nhanh hơn đầu in **√2 lần**. Vì vậy giới hạn tốc độ phải đặt cho từng motor, không đặt cho đầu in.

## 2. Cấu hình TIM2

| Thông số | Giá trị | Lý do |
|---|---|---|
| Timer | TIM2 | 32 bit, đặt chu kỳ dài thoải mái khi chạy chậm |
| Clock kernel | 240 MHz (APB1 timer clock) | |
| Prescaler | 239 | 240 MHz / 240 = 1 MHz, tức **1 tick = 1 µs** |
| ARR | chu kỳ bước, tính bằng µs | đặt lại ở mỗi lệnh chạy |
| CCR1 | 2 | độ rộng xung STEP, µs |
| ARPE | bật | ARR có preload |

Vì tick là 1 µs nên ARR đọc thẳng ra chu kỳ bước, không phải quy đổi gì.

## 3. Hai ngắt cho mỗi bước

```
           update (ARR)                 compare (CC1)
                │                             │
 STEP  ─────────┘‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾└───────────────
                │◄────────── 2 µs ───────────►│
                                              │◄─ phần còn lại của chu kỳ ─►│
         Bresenham,                      hạ cả hai
         nâng chân STEP                  chân STEP
```

- **Ngắt update**: cộng biến tích luỹ, motor nào tới lượt thì nâng chân STEP, cập nhật vị trí, giảm bộ đếm.
- **Ngắt compare CC1**: hạ cả hai chân STEP.

**Độ rộng xung do phần cứng timer đo**, CPU không chờ. Trong ngắt compare, code hạ cả hai chân mà không cần nhớ motor nào vừa bước, vì hạ một chân vốn đã thấp thì không tốn gì.

Cả hai ngắt đều vào `stepper_tim2_isr()`, gọi từ `TIM2_IRQHandler` trong `stm32h7xx_it.c`. Hàm này **tự xoá cờ**, nên `HAL_TIM_IRQHandler` chạy sau đó không thấy gì để làm và thoát ngay.

## 4. Bresenham

Một lệnh chạy có `n = max(|ΔA|, |ΔB|)` nhịp. Mỗi nhịp, motor nào có biến tích luỹ tràn thì bước:

```
err_a += |ΔA|;   nếu err_a >= n thì A bước, err_a -= n
err_b += |ΔB|;   nếu err_b >= n thì B bước, err_b -= n
```

Khởi tạo `err_a = err_b = n / 2` để các bước phân bố đều, mượt hơn so với khởi tạo bằng 0. Grbl cũng làm vậy.

Nhờ Bresenham, hai motor **luôn cùng bắt đầu và cùng kết thúc**, không cần hai timer.

## 5. Tính chu kỳ

```
length = hypot(dx, dy)          ← chiều dài trong XY, KHÔNG phải trong AB
duration = length / speed
period_us = duration × 10⁶ / n
```

Đây là chỗ dễ sai nhất. Nếu lấy chiều dài trong không gian AB thì tốc độ đầu in sẽ sai đúng bằng hệ số √2 ở các hướng chéo.

## 6. Ba chi tiết dễ vấp

**Xung cuối cùng.** Nếu tắt timer ngay khi hết bước thì ngắt compare không bao giờ tới, chân STEP kẹt ở mức cao. Cờ `stopping` giải quyết: ngắt update chỉ đánh dấu, ngắt compare hạ chân xong mới tắt timer.

**ARR có preload.** `ARPE = 1` nên ghi ARR chỉ có hiệu lực từ chu kỳ sau. Phải ép một sự kiện update bằng `TIM2->EGR = TIM_EGR_UG` để nạp ngay, nếu không chu kỳ đầu tiên của mỗi lệnh sẽ dùng giá trị của lệnh trước. Ở Bước 3 khi liên tục đổi ARR để tăng giảm tốc, chi tiết này càng quan trọng.

**Vị trí tính từ đích tuyệt đối.** Số bước cần đi được tính bằng
```
target_a = lroundf((x + y) × 80)      rồi   steps_a = target_a − pos_a
```
chứ không cộng dồn từng đoạn đã làm tròn. Nhờ vậy sai số không tích luỹ sau hàng nghìn đoạn. Grbl cũng tính như vậy.

## 7. Ngân sách CPU

Ước tính khoảng 1 µs cho cả hai ngắt cộng lại, sau khi bỏ vòng chờ.

| Tốc độ đầu in | Bước/s mỗi motor khi đi chéo | Tải CPU |
|---|---|---|
| 60 mm/s | 6.8 k | ~0.7% |
| 150 mm/s | 17 k | ~1.7% |
| 300 mm/s | 34 k | ~3.4% |

Trần cứng hiện tại là `MIN_PERIOD_US = 5`, tức **200 kHz mỗi motor**. Vượt quá thì `stepper_move_xy` trả về `STEPPER_ERROR`.

Phiên bản trước dùng vòng chờ 3 µs ngay trong ngắt, tốn khoảng 5 µs mỗi bước, tức gấp 5 lần.

## 8. Vì sao giữ vi bước 1/16

Bit `intpol` trong CHOPCONF đang bật, nên TMC2209 **tự nội suy 1/16 lên 1/256** bên trong. Dòng điện đã mượt đúng mức 1/256 trong khi MCU chỉ phải phát xung ở mức 1/16.

Tăng lên 1/32 hay 1/64 chỉ nhân tần số xung lên mà không thêm được độ mượt hay độ chính xác, vì mômen giữ của mỗi vi bước tỉ lệ với sin của góc và ở 1/16 đã chỉ còn khoảng 10%.

Đánh đổi duy nhất: nội suy gây sai lệch vị trí tới nửa vi bước, tức khoảng 6 µm, nhỏ hơn nhiều so với sai số của dây đai và khung máy.

## 9. API

```c
stepper_status_t stepper_init(void);
stepper_status_t stepper_move_xy(float dx_mm, float dy_mm, float speed_mm_s);
uint8_t  stepper_busy(void);
void     stepper_wait(void);          /* chỉ dùng để test */
int32_t  stepper_pos_a(void);
int32_t  stepper_pos_b(void);
float    stepper_pos_x(void);
float    stepper_pos_y(void);
void     stepper_tim2_isr(void);      /* gọi từ TIM2_IRQHandler */
```

`stepper_move_xy` trả về ngay, ngắt lo phần còn lại. Đang chạy mà gọi tiếp thì trả về `STEPPER_BUSY`.

## 10. Gia tốc hình thang

Mỗi block có ba pha: tăng tốc, chạy đều, giảm tốc. Tính trước ngoài ngắt, bằng số thực:

```
ticks_per_mm = n / length_mm
v_max = speed × ticks_per_mm        c_min  = 10⁶ / v_max
a     = accel × ticks_per_mm        ramp   = (v_max² − v_entry²) / (2a)
```

Trong ngắt chỉ còn công thức truy hồi số nguyên của **Atmel AVR446**:

```
tăng tốc:  c −= (2c + rest) / (4·(i + i_offset) + 1)
giảm tốc:  c += (2c + rest) / (4·(events_left + j_offset) + 1)
chạy đều:  c = c_min
```

`rest` giữ phần dư của phép chia nguyên nên sai số không tích luỹ. Nếu đoạn quá ngắn, hai dốc chồng lên nhau và profile tự thành **hình tam giác**, không bao giờ đạt tốc độ đặt. Đây là lý do máy in thật không chạy đúng tốc độ trong slicer ở các chi tiết nhỏ.

## 11. Lookahead

Hai lớp tách bạch:

| Lớp | Chạy ở | Số học | Việc |
|---|---|---|---|
| Planner | main loop | số thực | hàng đợi 16 block, tốc độ góc, hai lượt quét |
| Executor | ngắt | số nguyên | Bresenham, truy hồi AVR446, nạp block kế tiếp |

**Tốc độ qua góc** dùng mô hình junction deviation của grbl: góc giữa hai vector đơn vị quyết định tốc độ được phép, thẳng thì giữ nguyên, gập ngược thì về 0.

**Hai lượt quét** mỗi khi có block mới:
- Lùi: một block không được vào nhanh hơn mức còn phanh kịp để khớp tốc độ vào của block sau.
- Tới: cũng không được vào nhanh hơn mức block trước đẩy lên được.

Block mà ISR đang chạy không bao giờ bị sửa.

**Mẹo nối liền hai block:** `i_offset` và `j_offset` đặt tốc độ vào và ra lên đúng vị trí trên một đường dốc ảo xuất phát từ 0. Nhờ đó công thức truy hồi chạy tiếp liền mạch qua ranh giới block thay vì khởi động lại.

Đo trên máy thật, 100 mm ở 150 mm/s với gia tốc 2000:

| Cách gửi | Thời gian |
|---|---|
| 1 đoạn 100 mm | 728 ms |
| 20 đoạn 5 mm | 728 ms |
| 20 đoạn, nếu dừng ở mỗi điểm nối | 1633 ms (mô phỏng) |

Chia nhỏ không còn tốn gì. Với đường tròn 72 dây cung, mô phỏng cho thấy nhanh hơn **3.6 lần**.

## 12. Còn thiếu

- Parser G-code và lớp `motion_control` để chia cung tròn.
- Nạp lệnh từ thẻ nhớ hoặc USB.
- Input shaping.

Xem [checklist.md](checklist.md).
