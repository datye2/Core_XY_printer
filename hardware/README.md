# Phần cứng bo điều khiển CoreXY

```
hardware/
├── corexy_board/              Project KiCad (mở corexy_board.kicad_pro bằng KiCad 10)
│   ├── corexy_board.kicad_sch Trang gốc: sơ đồ khối, quyết định thiết kế, bảng gán chân MCU
│   ├── 01_Nguon.kicad_sch     XT60, TVS, cầu chì, buck 5V, chống USB cấp ngược, NetTie GND
│   ├── 02_MCU.kicad_sch       2 header 2x28 của kit FK743M2-IIT6
│   ├── 03_Driver.kicad_sch    2x TMC2209 (MKS V2.0, UART) + 3x A4988 (Z1, Z2, E)
│   ├── 04_Heater.kicad_sch    TC4427 + IRLB3034 cho hotend, bed (+ MOSFET an toàn)
│   ├── 05_Quat.kicad_sch      2 kênh AO3400A + quạt bo luôn bật
│   ├── 06_NTC.kicad_sch       3 kênh NTC 100k
│   ├── 07_IO.kicad_sch        3 cổng cảm biến NPN cách ly PC817, cảm biến hết nhựa, UART SBC
│   ├── corexy.kicad_sym       Symbol riêng (header kit, TMC2209 MKS, module buck, power net)
│   ├── corexy_board.pdf       Bản in schematic
│   └── bom.csv                Danh sách linh kiện (gom theo giá trị)
└── tools/
    ├── gen_schematic.py       Mô tả mạch bằng Python -> sinh toàn bộ schematic
    ├── check_schematic.py     Chạy ERC + so netlist KiCad với kết nối mong muốn
    └── intent_netlist.json    Kết nối mong muốn (do gen_schematic.py ghi)
```

## Sửa mạch

Hai cách, **chọn một**:

1. **Sửa trong script** (khuyên dùng khi còn đổi nhiều): sửa `tools/gen_schematic.py`, rồi
   ```
   cd hardware/tools
   python3 gen_schematic.py && python3 check_schematic.py
   ```
   `check_schematic.py` phải báo `0 lỗi so khớp`.
2. **Sửa tay trong KiCad**: từ lúc này **không chạy lại** `gen_schematic.py` nữa, vì nó ghi đè toàn bộ file.

## Quy ước net

- `GND` logic, `PGND` công suất (heater, quạt, cảm biến 24V), `MGND` motor → nối nhau 1 điểm qua `NT1`, `NT2`.
- `+24V_BED` / `+24V_HEAT` / `+24V_FAN` / `+24V_MOT` / `+24V_VMOT` / `+24V_SENS`: các nhánh sau cầu chì.
- `+5V` từ buck; `+5V_KIT` sau diode, cấp cho kit; `+3V3` lấy từ ổn áp trên kit.
- Chân nguồn nằm ngang được nối bằng global label cùng tên net nguồn (KiCad tự gộp với power symbol).
