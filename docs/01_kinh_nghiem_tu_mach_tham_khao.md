# Kinh nghiệm thiết kế rút ra từ các bo máy in 3D có sẵn

> Mục đích: tổng hợp cách các bo thương mại/mã nguồn mở giải quyết từng khối mạch,
> rồi đối chiếu với kế hoạch của bo CoreXY (kit FK743M2-IIT6 + 2×TMC2209 + 2×A4988, 24V).
> Bạn đánh dấu `[x]` vào các mục đồng ý, ghi chú mục muốn đổi → sau đó mới vẽ KiCad.
>
> Ngày lập: 2026-09-16

---

## 0. Các bo đã tham khảo

Tất cả schematic gốc được lưu trong `docs/references/`.

| Bo | MCU | Nguồn schematic | Ghi chú |
|---|---|---|---|
| **BTT SKR 2** | STM32F407VGT6 | `BTT_SKR2_SCH.pdf` | Bo phổ biến tầm trung, có bài học lỗi Rev A |
| **BTT Octopus Pro V1.1** | STM32F446 / H723 | `BTT_OctopusPro_V1.1_SCH.pdf` | Bo lớn cho Voron (CoreXY), thiết kế nguồn tách nhánh rõ |
| **Duet 2 v1.06** | ATSAM4E8E | `Duet2_v1.06_SCH.pdf` | Phần cứng mở, nổi tiếng về độ tin cậy |
| **Prusa Buddy v1.0.0** | STM32F407 | `Prusa_Buddy_v1.0.0_SCH.pdf` | Bo của Prusa MINI, sản xuất số lượng lớn |
| FANKE FK743M2-IIT6 | STM32H743IIT6 | `FANKE_FK743M2-IIT6_SCH.pdf` | Kit MCU của mình |

---

## 1. Khối nguồn vào & phân phối

### Các bo khác làm gì

| Bo | Cách chia nguồn | Cầu chì | Bảo vệ |
|---|---|---|---|
| Octopus Pro | **3 đầu vào riêng**: MOTOR_POWER / POWER / BED_POWER | 3 cầu chì riêng (F1 motor, F3 logic+heater, F2 bed) | LED báo từng rail (VM, 12V, 3.3V) |
| Duet 2 | 1 đầu vào, chia 3 nhánh | **Bed 15A**, Extruder/Stepper/5V **7.5A**, Fan **1A** | Tụ lọc VIN cạnh MOSFET |
| Prusa Buddy | 1 đầu vào, chia 2 nhánh | Bed/heater **7.5A**, Motor **3A** | TVS + ferrite + 330µF trên nhánh motor |
| SKR 2 | 1 đầu vào | **10A** (logic+motor), **15A** (bed) riêng | **TVS SMAJ28A** trên VIN, ferrite 30Ω lên VMOT |

- **Buck 5V** của cả 4 bo đều dùng IC chịu áp vào cao: AOZ1284 (SKR 2), SY8368 (Octopus Pro), LM25011 (Buddy). → Khớp với quyết định **tránh MP1584 (28V max)**, dùng LM2596S/XL4015.
- **Chống USB cấp ngược (backfeed)**: SKR 2 có jumper *DC SEL* + diode **SS14** trên VUSB; Octopus Pro có jumper J68 + diode **SK34**. → Xác nhận cách làm diode SS34 đã chọn là đúng hướng.
- **Giám sát điện áp**: Buddy có cầu chia **10k/1k** đo nguồn bàn nhiệt (BED_MON); SKR 2 và Octopus có cổng **PWR-DET** (phát hiện mất điện) và **PS-ON** (bật/tắt nguồn ATX).
- **Đặt tên GND theo vùng**: SKR 2 dùng 3 net `GND` (logic) / `PGND` (công suất heater, fan) / `MGND` (motor) → lúc làm PCB biết ngay đường nào nối hình sao ở đâu.

### ⚠️ Bài học lỗi thực tế

- **RAMPS 1.4**: cầu chì **polyfuse 11A** cho bàn nhiệt chạy sát giới hạn (bàn 200×200 ăn 8–10A), MOSFET Rds(on) cao, đường đồng/pad mỏng → **nóng chảy đầu nối**. Cách sửa cộng đồng: thay MOSFET Rds(on) thấp hơn và thay polyfuse bằng **cầu chì ô tô dạng lưỡi**.
- **SKR 2 Rev A**: BTT thêm mạch "bảo vệ driver cắm ngược" bằng MOSFET đóng/cắt **đường GND của motor (MGND↔PGND)**. Chính MOSFET đó bị lỗi → **làm hỏng driver** mà nó định bảo vệ. Rev B phải đổi linh kiện; cách chữa tạm là nối tắt MGND với PGND.
  → **Không chèn MOSFET/cầu chì nhỏ vào đường GND của driver.** GND motor phải là đường liền, chắc.

### Áp dụng cho bo của mình

- [ ] Đầu vào **XT60** + **TVS SMBJ28A** + **1000µF/35V** ngay sau đầu vào
- [ ] 3 cầu chì lưỡi ô tô: **Bed 15A** / **Hotend + fan 5A** / **Motor + logic 5A**
- [ ] Nhánh motor: thêm **ferrite bead** (≥5A) như SKR 2 / Buddy *(tùy chọn)*
- [ ] Buck **LM2596S hoặc XL4015** module, đầu ra 5.2V + **470µF + TVS SMBJ5.0A** trên bo
- [ ] Diode **SS34** giữa buck và chân 5V của kit (chống backfeed USB)
- [ ] Cầu chia **100k/10k + 100nF** đo 24V vào ADC (phát hiện mất nguồn / quá áp)
- [ ] LED báo nguồn 24V / 5V / 3.3V
- [ ] Dùng 3 net GND riêng trên schematic: `GND`, `PGND`, `MGND`, nối nhau tại **1 điểm** (net-tie)
- [ ] Đường GND motor **không** qua MOSFET/cầu chì nào

---

## 2. Khối MOSFET heater (hotend + bàn nhiệt)

### Các bo khác làm gì

| Bo | MOSFET bàn nhiệt | MOSFET hotend | Mạch lái gate | R gate / R kéo xuống | Diode ở đầu ra | LED báo |
|---|---|---|---|---|---|---|
| Duet 2 | IPD036N04L (40V) | AOD4184A (40V) | **74HCT02 @5V** (cổng NOR) | 180Ω / — | Không | Có (4k7) |
| Octopus Pro | IPD036N04L (40V) | HY1904C (40V) | **CD4504B @12V** | 1kΩ / 10kΩ | **SS54** | Có (4k7) |
| Prusa Buddy | PSMN2R6-40YS (40V) | PSMN2R6-40YS (40V) | Level converter **@5V** | 100Ω / 100kΩ | **SK310A (100V/3A)** | Có (10k) |
| SKR 2 | HYG017N04LS1C2 (40V) | HY1904C2 (40V) | **74HCT365 @5V** | 10Ω / 100kΩ | Không | Có (4k7) |

**Nhận xét rút ra:**

1. **Cả 4 bo đều dùng MOSFET 40V, Rds(on) vài mΩ.** → IRLB3034 (40V, ~2mΩ) đã chọn là đúng loại.
2. **Không bo nào lái gate trực tiếp bằng 3.3V** — đều qua buffer 5V hoặc 12V. → Xác nhận cần TC4427 (hoặc buffer 74HCT).
3. **Diode ngược ở đầu ra heater**: Octopus Pro và Buddy có, SKR 2/Duet không. Lý do nên có: người dùng hay cắm tải cảm (quạt, bơm, van điện từ) vào cổng heater, và dây dài cũng có điện cảm. Rẻ, nên thêm.
4. **Tất cả đều có LED báo** trên từng đầu ra.
5. **Duet 2 có mẹo an toàn khi khởi động**: dùng cổng NOR 74HCT02, một cổng lấy 3.3V làm tín hiệu "cho phép" → khi rail 3.3V chưa lên (MCU chưa chạy) thì **tất cả heater bị ép TẮT**, dù chân MCU đang thả nổi.
6. Duet 2 đặt **tụ 10µF/35V sát MOSFET bàn nhiệt** (giữa V_BED và Source) để giảm nhiễu khi đóng cắt.

### Hai lựa chọn mạch lái gate cho bo mình

| | **TC4427** (đã đề xuất) | **74HCT365 / 74HCT244** (như SKR 2, Octopus) |
|---|---|---|
| Dòng lái gate | 1.5A đỉnh → đóng cắt nhanh | ~25mA → chậm hơn, vẫn đủ cho PWM heater tần số thấp |
| Số kênh | 2 kênh / IC | 6 (365) hoặc 8 (244) kênh / IC → **gom luôn cả quạt** |
| Nguồn | 4.5–18V | 5V |
| Đầu vào 3.3V | Được (VIH 2.4V) | Được (HCT: VIH 2.0V) |
| Giá / dễ mua | Đắt hơn | Rất rẻ, rất phổ biến |

### Áp dụng cho bo của mình

- [ ] MOSFET heater + bed: **IRLB3034PbF** (THT cho bo thử)
- [ ] Mạch lái gate: **TC4427 @5V** ☐ hoặc **74HCT365 @5V** (gom cả heater + quạt) ☐ ← *chọn 1*
- [ ] R gate **22–100Ω**, R kéo xuống ở gate **10kΩ**, R kéo xuống ở đầu vào buffer **10kΩ**
- [ ] **Diode SS54** song song ngược ở mỗi đầu ra heater (như Octopus Pro / Buddy)
- [ ] LED + **4.7kΩ** báo trạng thái mỗi đầu ra
- [ ] Tụ **10µF/35V** sát MOSFET bàn nhiệt (như Duet 2)
- [ ] *(Tùy chọn)* Khóa heater khi MCU chưa chạy kiểu Duet 2 (dùng chân OE của buffer nối với "MCU ready")
- [ ] Chân ngắt tổng bàn nhiệt (PA4 → relay/MOSFET phía cao) — *không bo nào ở trên có*, là lớp bảo vệ thêm của mình

---

## 3. Khối quạt

### Các bo khác làm gì

| Bo | MOSFET | Lái gate | R gate / R kéo xuống | Diode flyback | Chọn điện áp quạt |
|---|---|---|---|---|---|
| Duet 2 | **AO3400A** | Trực tiếp từ MCU | 1kΩ / 10kΩ | **Có** (DO-219AB) | Jumper 5V / V_FAN / VIN + cầu chì **1A** |
| Octopus Pro | **ES3400** (tương đương AO3400) | 74HCT365 @5V | 22Ω / 10kΩ | **Có** (SS2FH) | Jumper **từng quạt**: 5V / 12V / VIN |
| SKR 2 | **ES3400** | 74HCT365 @5V | 10Ω / 100kΩ | **Không** (chỉ có LED) | Không |
| Prusa Buddy | — | — | — | — | Có chân **đo tốc độ (TACH)** cho quạt |

**Nhận xét:**
- AO3400A/ES3400 là lựa chọn chuẩn cho quạt → khớp kế hoạch.
- Duet 2 lái AO3400A **trực tiếp bằng 3.3V** vẫn chạy tốt với quạt nhỏ → không bắt buộc buffer cho quạt.
- **Buddy đo tốc độ quạt (TACH)**: nếu quạt tản nhiệt hotend chết → nhựa bị nóng chảy ngược lên phía trên (heat creep) → firmware phát hiện được để dừng in.

### Áp dụng cho bo của mình

- [ ] 3 kênh quạt dùng **AO3400A**, R gate 100Ω, R kéo xuống 100kΩ
- [ ] Diode flyback **SS14/SS24** mỗi kênh (theo Duet/Octopus, không theo SKR 2)
- [ ] LED + 4.7kΩ báo mỗi kênh
- [ ] *(Tùy chọn)* Jumper chọn áp quạt **5V / 24V** mỗi kênh (nếu sau này dùng quạt 5V/12V)
- [ ] *(Tùy chọn)* Chân **TACH** cho quạt hotend (quạt 3 dây) → 1 GPIO + pull-up 10k lên 3.3V
- [ ] Cầu chì nhỏ **1–2A** cho nhánh quạt (như Duet 2)

---

## 4. Khối đo nhiệt độ (thermistor)

### Các bo khác làm gì — **SKR 2, Octopus Pro, Prusa Buddy dùng GẦN NHƯ Y HỆT nhau**

```
3.3V ──[4.7kΩ 1%]──┬──[2.37kΩ 1%]──┬──[2.37kΩ 1%]──┬── ADC MCU
                   │               │               │
             Đầu nối NTC       BAV99 (kẹp       [100nF]
                   │           về 3.3V & GND)      │
                  GND                             GND
```

- **4.7kΩ 1%** pull-up lên 3.3V
- **2 điện trở 2.37kΩ 1% nối tiếp**, điểm giữa có **BAV99** (2 diode kẹp lên 3.3V và xuống GND)
  → nếu dây NTC chạm dây heater 24V: điện trở đầu hạn dòng, BAV99 kẹp áp, điện trở sau bảo vệ tiếp chân ADC
- **100nF** sát chân ADC để lọc
- **Buddy** thêm **ferrite** trên đường GND trả về của NTC
- **Duet 2** ghi chú: *"All thermistors should be pulled up to ADVREF"* — pull-up lên chân **điện áp tham chiếu ADC** thay vì 3.3V chung → giá trị đo ổn định hơn khi 3.3V bị nhiễu
- **Octopus Pro** có thêm kênh **PT100/PT1000** qua **MAX31865** (cho hotend nhiệt độ cao)

> ⚠️ **Khác với đề xuất trước của mình** (1kΩ + 10µF). Thiết kế 4.7k / 2×2.37k / BAV99 / 100nF đã được kiểm chứng trên hàng trăm nghìn bo → **nên theo thiết kế này**.
>
> 📝 Ghi chú cho firmware sau này: tổng điện trở nối tiếp ~4.7kΩ + tụ 100nF → cần **thời gian lấy mẫu ADC dài** (sample time lớn) để đọc đúng.

### Áp dụng cho bo của mình

- [ ] 3 kênh NTC theo mạch chung ở trên: **4.7k 1% / 2×2.37k 1% / BAV99 / 100nF**
- [ ] Pull-up lên: **VREF của kit** (như Duet) ☐ hoặc **3.3V** (như BTT/Prusa) ☐ ← *chọn 1*
- [ ] *(Tùy chọn)* Ferrite trên GND trả về (như Buddy)
- [ ] *(Tùy chọn)* Chừa chỗ **MAX31865** cho PT1000 — hay để dành bản sau

---

## 5. Khối công tắc hành trình, probe, cảm biến

### Các bo khác làm gì

**Công tắc hành trình** (SKR 2 và Octopus Pro):
```
Đầu nối 3 chân: [+5V] [GND] [Tín hiệu]
                                 │
3.3V ──[10kΩ]────────────────────┤
                                 ├──[1kΩ (SKR 2) / 100Ω (Octopus)]──┬── MCU
                                                                    │
                                                                 [100nF]
                                                                    │
                                                                   GND
```
- Đầu nối cấp **+5V** để nuôi cảm biến quang/hall, nhưng tín hiệu được **kéo lên 3.3V**.

**Chân DIAG cho sensorless** — mẹo hay:
- SKR 2: **jumper nối DIAG của driver vào chính đường endstop** (X-DIAG ↔ XMIN).
- Octopus Pro: DIAG nối vào net endstop qua **100Ω**.
- → Không tốn thêm chân MCU; muốn sensorless thì cắm jumper + rút công tắc cơ.

**Probe** (Octopus Pro — rất đáng học):
- Cổng probe có **optocoupler EL357C** + điện trở **1kΩ 0.6W** → nhận được probe cảm ứng từ chạy **12–24V** mà không hại MCU.
- **Jumper chọn áp nuôi probe**: 5V / 12V / VIN.
- **Jumper pull-up 12kΩ** để dùng được cả probe loại **NPN** và **PNP**.
- Cổng **BLTouch** riêng 5 chân (5V, GND, servo, GND, tín hiệu).

**Khác:**
- Cổng **PWR-DET** (10k pull-up + 100Ω + 100nF) và **PS-ON** (SKR 2, Octopus).
- LED **Neopixel/RGB**: dùng **74LVC1G125 nuôi 5V** để nâng mức tín hiệu 3.3V → 5V (SKR 2, Octopus).

### Áp dụng cho bo của mình

- [ ] 3 cổng endstop X/Y/Z: đầu nối 3 chân (5V, GND, S) + **10k lên 3.3V + 1kΩ + 100nF**
- [ ] Thêm **diode ESD** (PESD3V3 hoặc tương đương) trên mỗi tín hiệu — *các bo trên không có, là lớp thêm*
- [ ] DIAG: **nối riêng vào PD7/PG11** (kế hoạch cũ) ☐ hoặc **jumper vào đường endstop như SKR 2** (tiết kiệm chân) ☐ ← *chọn 1*
- [ ] Cổng **BLTouch** riêng (5V, GND, servo PB1, GND, tín hiệu)
- [ ] Cổng **probe cảm ứng từ** có **optocoupler EL357/PC817** + jumper áp nuôi 5V/24V + jumper pull-up NPN/PNP
- [ ] Cổng **cảm biến hết nhựa** (giống endstop)
- [ ] *(Tùy chọn)* Cổng **Neopixel** với 74LVC1G125 @5V
- [ ] *(Tùy chọn)* Cổng **E-stop**

---

## 6. Khối driver động cơ

### Các bo khác làm gì

- **Tụ 100µF/35V** sát chân VM **mỗi** driver (tất cả các bo).
- **Điện trở kéo lên 10kΩ lên 3.3V ở chân EN** (SKR 2) → driver **mặc định TẮT** khi MCU đang khởi động/nạp code.
- **Header jumper chân MS1/MS2/MS3** cạnh mỗi socket (SKR 2 `XMS1`) → cùng một socket cắm được **A4988, DRV8825, TMC2209** chỉ bằng cách đổi jumper.
- SKR 2/Octopus có header chọn **chế độ UART/SPI** cho TMC.
- Octopus Pro có **header 4 chân nối song song** cổng động cơ Z → cắm 2 động cơ Z song song mà không cần tự chế dây.
- ⚠️ **SKR 2 Rev A**: mạch bảo vệ driver bằng MOSFET trên MGND bị lỗi → hỏng driver (xem mục 1).

### Áp dụng cho bo của mình

- [ ] **4 socket driver giống hệt nhau** (A, B, Z, E) + **1 socket Z2 dự phòng**
- [ ] Mỗi socket: **100µF/35V low-ESR + 100nF** sát VM
- [ ] **10kΩ kéo lên 3.3V ở chân EN** mỗi driver
- [ ] **Header jumper MS1/MS2/MS3** mỗi socket → socket nào cũng cắm được cả TMC2209 lẫn A4988
- [ ] Đường UART TMC: **1kΩ** từ TX xuống đường PDN_UART chung, jumper nối vào từng socket
- [ ] Nối **RESET ↔ SLEEP** cho A4988 (bằng jumper, vì TMC2209 dùng chân này khác)
- [ ] Cổng Z: **2 đầu nối 4 chân** cạnh nhau, đi dây sẵn theo kiểu **nối tiếp** ☐ / **song song** ☐ ← *chọn 1*
- [ ] **Không** làm mạch bảo vệ bằng MOSFET trên GND motor
- [ ] In rõ chiều cắm driver trên silkscreen (để PCB sau)

---

## 7. Giao tiếp, debug & phụ trợ

### Các bo khác làm gì

- **ESD USB**: SKR 2 dùng **USBLC6-2P6** trên D+/D−. → Kit FK743M2 **không có** ESD trên USB (đã kiểm tra schematic kit). Không sửa được trên kit, cần lưu ý khi cắm rút.
- **Test point** (Duet 2): chừa test point cho STEP/DIR/EN từng trục và tín hiệu PWM từng heater, quạt.
- **CAN** (Octopus Pro): transceiver + ESD **PESD2CAN** → dành cho board đầu in sau này.
- Octopus Pro có **còi (buzzer)** và cổng **EXP1/EXP2** cho màn hình.

### Áp dụng cho bo của mình

- [ ] Header UART cho **SBC sau này** (TX, RX, GND, 5V)
- [ ] Test point: 24V, 5V, 3.3V, VREF, GND, PGND, MGND, STEP/DIR của A & B, PWM heater
- [ ] *(Tùy chọn)* Chừa footprint **CAN transceiver** (TJA1051) + ESD
- [ ] *(Tùy chọn)* Buzzer báo lỗi (thermal runaway)
- [ ] Kit FK743M2 cắm qua **2 hàng header cái 28×2** để tháo rời được

---

## 8. Tóm tắt: thay đổi so với kế hoạch đã bàn

| # | Hạng mục | Kế hoạch cũ | Đề xuất mới (theo bo tham khảo) |
|---|---|---|---|
| 1 | Lọc NTC | 1kΩ + 10µF | **4.7k / 2×2.37k / BAV99 / 100nF** (SKR 2, Octopus, Buddy) |
| 2 | Đầu ra heater | Không diode | **Thêm SS54** (Octopus, Buddy) |
| 3 | Chân EN driver | Dựa vào pull-up nội PA15 | **10kΩ kéo lên ngoài** mỗi driver (SKR 2) |
| 4 | Socket driver | Cố định loại driver | **Jumper MS1–3** để đổi A4988 ↔ TMC2209 tự do (SKR 2) |
| 5 | Mạch lái gate | TC4427 | TC4427 **hoặc** 74HCT365 gom cả quạt (SKR 2, Octopus) — *cần chọn* |
| 6 | GND | 1 net GND | **3 net GND / PGND / MGND** nối 1 điểm (SKR 2) |
| 7 | Cổng probe | BLTouch | BLTouch **+ cổng opto cho probe 24V** (Octopus) |
| 8 | Quạt hotend | PWM | PWM **+ TACH** (Buddy) — *tùy chọn* |
| 9 | Cầu chì quạt | Chung nhánh 5A | **Cầu chì 1–2A riêng** (Duet 2) — *tùy chọn* |
| 10 | Tụ bàn nhiệt | Không | **10µF/35V sát MOSFET** (Duet 2) |

---

## 9. Các điểm cần bạn quyết định trước khi vẽ

1. Mạch lái gate: **TC4427** hay **74HCT365**?
2. Pull-up NTC lên **VREF** hay **3.3V**?
3. DIAG: **chân riêng** hay **jumper vào endstop**?
4. Hai động cơ Z trên 1 A4988: **nối tiếp** hay **song song**?
5. Các mục *(Tùy chọn)* nào muốn đưa vào bản schematic đầu tiên?

### ✅ Đã chốt (2026-09-16)

| # | Quyết định |
|---|---|
| 1 | Mạch lái gate heater: **TC4427 @5V** (quạt: AO3400A lái trực tiếp 3.3V như Duet 2) |
| 2 | Pull-up NTC lên **3.3V** |
| 3 | DIAG TMC2209 nối **chân MCU riêng** (PD7, PG11) |
| 4 | Trục Z: **2 driver A4988 riêng** cho Z1 và Z2 → tổng 5 driver: A, B (TMC2209) + Z1, Z2, E (A4988) |
| 5 | MOSFET heater + bed: **IRLB3034PbF** (40V, ≤2.0mΩ @4.5V, TO-220) — không cần tản nhiệt; hàng thay thế: IRL3705N + tản nhiệt nhỏ |
| 6 | Homing X, Y, Z: **cả 3 đều cảm biến tiệm cận NPN** (Z dùng làm probe) → **3 cổng giống hệt nhau, cách ly PC817, chỉ NPN (không jumper)**: 1.5kΩ 0.5W + LED báo nối tiếp + 1N4148 ngược song song LED opto; phía MCU pull-up 10k lên 3.3V + 1kΩ + 100nF. Nguồn cảm biến 24V qua **cầu chì PTC 500mA** riêng. Không làm cổng BLTouch |
| 7 | Tùy chọn: ✅ ferrite nhánh motor, ✅ cầu chì quạt 1–2A riêng, ✅ tụ 10µF sát MOSFET bed; ❌ TACH (quạt 2 dây), ❌ khóa heater kiểu Duet, Neopixel, E-stop, buzzer, CAN, MAX31865 |
| 8 | **Ngắt tổng bàn nhiệt**: IRLB3034 thứ 2 **nối tiếp phía GND**, lái bằng **TC4427 thứ 2** (PA4); kênh còn dư để dự phòng |
| 9 | Quạt (đều 2 dây 24V): **part fan PWM** (AO3400A), **hotend fan bật/tắt** (AO3400A), **board fan luôn bật** (không MOSFET) |
| 10 | Tải: bed ≤250W (cầu chì 15A, terminal 7.62), hotend 40–60W (cầu chì 5A, terminal 5.08), NTC 100k B3950 |
| 11 | Thêm: cổng **cảm biến hết nhựa** (PC6), **header UART cho SBC**, **test point** |
| 12 | Đầu nối: JST-XH 2.54 (motor, cảm biến, quạt, NTC), XT60 nguồn vào |
| 13 | **TMC2209 = MKS V2.0** (pinout shop Đức Huy khớp MKS): hàng logic từ EN: `EN, MS1, MS2, NC, PDN, CLK, STEP, DIR`; hàng nguồn: `VM, GND, 1B, 1A, 2A, 2B, VIO, GND`; DIAG là chân rời phía trên → nối **dây Dupont** vào header 2 chân trên bo |
| 14 | Socket **A, B (TMC2209)**: pin4 NC, **pin5 PDN → bus UART**, pin6 CLK để hở (clock nội), VIO = 3.3V; địa chỉ UART bằng MS1/MS2: **A = 0 (GND/GND)**, **B = 1 (3.3V/GND)**; bus: PB10 (TX) qua 1kΩ, PB11 (RX) nối thẳng bus |
| 15 | Socket **Z1, Z2, E (A4988)**: MS1–3 lên 3.3V (1/16), **RESET↔SLEEP bằng jumper tháo được** (rút jumper là cắm TMC2209 chế độ standalone được), VDD = 3.3V |
| 16 | Tất cả socket: EN kéo lên 10kΩ lên 3.3V, 100µF/35V + 100nF sát VM |

---

## Nguồn

- BTT SKR 2: https://github.com/bigtreetech/SKR-2
- BTT Octopus Pro: https://github.com/bigtreetech/BIGTREETECH-OCTOPUS-Pro
- Duet 2 hardware: https://github.com/Duet3D/Duet-2-Hardware
- Prusa Buddy board: https://github.com/prusa3d/Buddy-board-MINI-PCB
- FANKE FK743M2-IIT6: https://github.com/nr-electronics/STM32H743_FANKE 
- Lỗi SKR 2 Rev A: https://3dwork.io/en/skr-2-failure-rev-a/ và https://github.com/bigtreetech/SKR-2/issues/15
- Lỗi RAMPS 1.4 bàn nhiệt: https://reprap.org/wiki/RAMPS_1.4
