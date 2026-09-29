#!/usr/bin/env python3
"""Sinh schematic KiCad cho bo điều khiển máy in 3D CoreXY.

Mạch được mô tả bằng Python (danh sách linh kiện + net nối vào từng chân), script tự
dàn trang, nối chân bằng dây ngắn + nhãn (global label / local label / power symbol),
rồi ghi ra project KiCad trong ../corexy_board/.

Chạy lại script sẽ GHI ĐÈ toàn bộ file schematic. Nếu đã sửa tay trong KiCad thì
đừng chạy lại (hoặc sửa mô tả trong script trước).

Cách kiểm tra sau khi sinh:  python3 check_schematic.py
"""
import copy
import json
import os
import re
import uuid as uuidlib
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'corexy_board'))
PROJECT = 'corexy_board'
KICAD_SYM = '/usr/share/kicad/symbols'
GRID = 1.27
STUB = 2.54

_uuid_ns = uuidlib.UUID('6f1c7f0e-8f64-4d1c-9a3e-5b7c1d2e3f40')
_uuid_counter = [0]


def new_uuid():
    # UUID ổn định giữa các lần chạy để diff git gọn
    _uuid_counter[0] += 1
    return str(uuidlib.uuid5(_uuid_ns, str(_uuid_counter[0])))


# ---------------------------------------------------------------- S-expression
class Q(str):
    """Chuỗi có ngoặc kép (nội dung đã escape theo kiểu KiCad)."""


def qs(text):
    return Q(text.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n'))


def parse(text):
    toks = re.findall(r'\(|\)|"(?:[^"\\]|\\.)*"|[^\s()"]+', text)
    pos = 0

    def rd():
        nonlocal pos
        t = toks[pos]
        pos += 1
        if t == '(':
            lst = []
            while toks[pos] != ')':
                lst.append(rd())
            pos += 1
            return lst
        if t.startswith('"'):
            return Q(t[1:-1])
        return t
    return rd()


def fmt(v):
    if isinstance(v, float) or isinstance(v, int):
        s = ('%.4f' % v).rstrip('0').rstrip('.')
        return '0' if s in ('-0', '') else s
    return str(v)


def atom(c):
    return '"%s"' % c if isinstance(c, Q) else fmt(c)


def ser(n, ind=0):
    pad = '\t' * ind
    if all(not isinstance(c, list) for c in n):
        return pad + '(' + ' '.join(atom(c) for c in n) + ')'
    i = 0
    head = []
    while i < len(n) and not isinstance(n[i], list):
        head.append(atom(n[i]))
        i += 1
    out = [pad + '(' + ' '.join(head)]
    for c in n[i:]:
        out.append(ser(c, ind + 1) if isinstance(c, list) else pad + '\t' + atom(c))
    out.append(pad + ')')
    return '\n'.join(out)


def find(node, key):
    for c in node:
        if isinstance(c, list) and c and c[0] == key:
            return c
    return None


# ---------------------------------------------------------------- thư viện symbol
_libtext = {}


def _lib_block(lib, name):
    path = f'{KICAD_SYM}/{lib}.kicad_sym'
    if path not in _libtext:
        _libtext[path] = open(path, encoding='utf-8').read()
    txt = _libtext[path]
    i = txt.find(f'\n\t(symbol "{name}"\n')
    if i < 0:
        raise KeyError(f'{lib}:{name}')
    i += 1
    depth, j, instr = 0, i, False
    while True:
        ch = txt[j]
        if instr:
            if ch == '\\':
                j += 1
            elif ch == '"':
                instr = False
        elif ch == '"':
            instr = True
        elif ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0:
                return parse(txt[i:j + 1])
        j += 1


def load_lib_symbol(lib, name):
    blk = _lib_block(lib, name)
    ext = find(blk, 'extends')
    if not ext:
        blk[1] = Q(f'{lib}:{name}')
        return blk
    parent_name = str(ext[1])
    sym = load_lib_symbol(lib, parent_name)
    sym[1] = Q(f'{lib}:{name}')
    for c in sym:
        if isinstance(c, list) and c[0] == 'symbol':
            c[1] = Q(str(c[1]).replace(parent_name + '_', name + '_', 1))
    child_props = {str(c[1]): c for c in blk if isinstance(c, list) and c[0] == 'property'}
    for k, c in enumerate(sym):
        if isinstance(c, list) and c[0] == 'property' and str(c[1]) in child_props:
            sym[k] = child_props.pop(str(c[1]))
    first_sub = next(k for k, c in enumerate(sym) if isinstance(c, list) and c[0] == 'symbol')
    for c in child_props.values():
        sym.insert(first_sub, c)
    return sym


def symbol_pins(sym):
    pins = []
    for c in sym:
        if not (isinstance(c, list) and c[0] == 'symbol'):
            continue
        m = re.match(r'.*_(\d+)_(\d+)$', str(c[1]))
        if not m or int(m.group(1)) > 1 or int(m.group(2)) > 1:
            continue
        for p in c:
            if isinstance(p, list) and p[0] == 'pin':
                at = find(p, 'at')
                pins.append(dict(type=p[1], x=float(at[1]), y=float(at[2]), a=int(float(at[3])),
                                 name=str(find(p, 'name')[1]), num=str(find(p, 'number')[1])))
    return pins


def font(size=1.27):
    return ['font', ['size', size, size]]


def prop(name, value, x=0.0, y=0.0, angle=0, hide=False, justify=None, size=1.27):
    eff = ['effects', font(size)]
    if justify:
        eff.append(['justify'] + justify.split())
    if hide:
        eff.append(['hide', 'yes'])
    return ['property', qs(name), qs(value), ['at', x, y, angle], eff]


def pin_node(ptype, x, y, a, name, num, length=2.54):
    return ['pin', ptype, 'line', ['at', x, y, a], ['length', length],
            ['name', qs(name), ['effects', font()]], ['number', qs(num), ['effects', font()]]]


def box_symbol(name, ref, value, fp, desc, left, right, top=(), bottom=(), width=20.32, pitch=2.54):
    """Symbol hình chữ nhật: left/right/top/bottom là list (tên, số, kiểu)."""
    rows = max(len(left), len(right), 1)
    h = (rows + 1) * pitch
    y0 = (rows - 1) * pitch / 2
    x_half = width / 2
    pins = []
    for i, (pn, num, pt) in enumerate(left):
        pins.append(pin_node(pt, -x_half - 2.54, y0 - i * pitch, 0, pn, num))
    for i, (pn, num, pt) in enumerate(right):
        pins.append(pin_node(pt, x_half + 2.54, y0 - i * pitch, 180, pn, num))
    for i, (pn, num, pt) in enumerate(top):
        pins.append(pin_node(pt, (i - (len(top) - 1) / 2) * 5.08, h / 2 + 2.54, 270, pn, num))
    for i, (pn, num, pt) in enumerate(bottom):
        pins.append(pin_node(pt, (i - (len(bottom) - 1) / 2) * 5.08, -h / 2 - 2.54, 90, pn, num))
    return ['symbol', Q('corexy:' + name),
            ['pin_names', ['offset', 1.016]],
            ['exclude_from_sim', 'no'], ['in_bom', 'yes'], ['on_board', 'yes'],
            prop('Reference', ref, -x_half, h / 2 + 1.27, justify='left'),
            prop('Value', value, -x_half, -h / 2 - 1.27, justify='left'),
            prop('Footprint', fp, hide=True),
            prop('Datasheet', '', hide=True),
            prop('Description', desc, hide=True),
            ['symbol', Q(name + '_0_1'),
             ['rectangle', ['start', -x_half, h / 2], ['end', x_half, -h / 2],
              ['stroke', ['width', 0.254], ['type', 'default']], ['fill', ['type', 'background']]]],
            ['symbol', Q(name + '_1_1')] + pins,
            ['embedded_fonts', 'no']]


def power_symbol(net, ground):
    base = load_lib_symbol('power', 'GND' if ground else '+24V')
    old = 'GND' if ground else '+24V'
    sym = copy.deepcopy(base)
    sym[1] = Q('corexy:' + net)
    for k, c in enumerate(sym):
        if isinstance(c, list) and c[0] == 'symbol':
            c[1] = Q(str(c[1]).replace(old + '_', net + '_', 1))
        if isinstance(c, list) and c[0] == 'property':
            if str(c[1]) == 'Value':
                c[2] = qs(net)
            if str(c[1]) == 'Description':
                c[2] = qs(f'Power symbol cho net {net}')
    return sym


# ---------------------------------------------------------------- dữ liệu phần cứng
# Header kit FANKE FK743M2-IIT6 (đọc từ schematic chính thức, docs/references/)
FK743_P2 = {1: 'GND', 2: 'GND', 3: 'GND', 4: 'GND', 5: '5V', 6: '5V', 7: 'RST', 8: 'BOOT0',
            9: 'PA12', 10: 'PA11', 11: 'PI0', 12: 'PI1', 13: 'PH14', 14: 'PH15', 15: 'PC6', 16: 'PH13',
            17: 'PG6', 18: 'PC7', 19: 'PC8', 20: 'PG7', 21: 'PA8', 22: 'PC9', 23: 'PD2', 24: 'PC12',
            25: 'PG12', 26: 'PD6', 27: 'PI2', 28: 'PG14', 29: 'PC10', 30: 'PI3', 31: 'PC11', 32: 'PA15',
            33: 'PD4', 34: 'PD3', 35: 'PD7', 36: 'PD5', 37: 'PG10', 38: 'PG9', 39: 'PB3', 40: 'PG11',
            41: 'PB5', 42: 'PB4', 43: 'PB8', 44: 'PB7', 45: 'PC13', 46: 'PB9', 47: 'PE6', 48: 'PE5',
            49: 'PE4', 50: 'PE3', 51: 'PF10', 52: 'PG13', 53: 'PI9', 54: 'PI10', 55: 'VBT', 56: 'PH4'}
FK743_P3 = {1: 'GND', 2: 'GND', 3: '3V3', 4: '3V3', 5: 'SWCLK', 6: 'PA10', 7: 'SWDIO', 8: 'PA9',
            9: 'PD12', 10: 'PB6', 11: 'PE2', 12: 'PD13', 13: 'PD11', 14: 'PB2', 15: 'PF6', 16: 'PF7',
            17: 'PF8', 18: 'PF9', 19: 'PC0', 20: 'PC1', 21: 'PC2', 22: 'PC3', 23: 'PB13', 24: 'PB15',
            25: 'PB14', 26: 'PB12', 27: 'PH12', 28: 'PH8', 29: 'PH11', 30: 'PH10', 31: 'PH9', 32: 'PH7',
            33: 'PB11', 34: 'PH6', 35: 'PI4', 36: 'PB10', 37: 'PI5', 38: 'PI6', 39: 'PI7', 40: 'PB1',
            41: 'PB0', 42: 'PC5', 43: 'PA7', 44: 'PC4', 45: 'PA4', 46: 'PA6', 47: 'PA3', 48: 'PA5',
            49: 'PA1', 50: 'PA2', 51: 'PI8', 52: 'PA0', 53: 'PI11', 54: 'PG3', 55: 'VREF', 56: 'GND'}

# Chân MCU -> net
PINMAP = {
    'PD3': 'A_STEP', 'PD4': 'A_DIR', 'PA15': 'XY_EN', 'PD7': 'A_DIAG',
    'PG9': 'B_STEP', 'PG10': 'B_DIR', 'PG11': 'B_DIAG',
    'PE3': 'Z1_STEP', 'PE4': 'Z1_DIR', 'PB3': 'Z1_EN',
    'PF6': 'Z2_STEP', 'PF7': 'Z2_DIR', 'PF8': 'Z2_EN',
    'PB12': 'E_STEP', 'PB13': 'E_DIR', 'PB7': 'E_EN',
    'PB10': 'TMC_UART_TX', 'PB11': 'TMC_UART',
    'PC0': 'TH_HOTEND', 'PC1': 'TH_BED', 'PC4': 'TH_SPARE',
    'PB8': 'HOTEND_PWM', 'PB9': 'BED_PWM', 'PA4': 'BED_SAFETY',
    'PB14': 'PART_FAN_PWM', 'PB15': 'HOTEND_FAN_EN',
    'PA6': 'X_HOME', 'PA7': 'Y_HOME', 'PC7': 'Z_PROBE', 'PC6': 'FIL_RUNOUT',
    'PC5': 'VIN_SENSE', 'PA0': 'SBC_TX', 'PA1': 'SBC_RX',
}
PINMAP_NOTE = {
    'A_STEP': 'TMC2209 A', 'XY_EN': 'EN chung A+B', 'TMC_UART_TX': 'USART3_TX (qua 1k)',
    'TMC_UART': 'USART3_RX = bus UART', 'TH_HOTEND': 'ADC', 'HOTEND_PWM': 'TIM4_CH3',
    'BED_PWM': 'TIM4_CH4', 'PART_FAN_PWM': 'TIM12_CH1', 'SBC_TX': 'UART4_TX', 'SBC_RX': 'UART4_RX',
    'VIN_SENSE': 'ADC, 24V/11',
}

GROUND_NETS = {'GND', 'PGND', 'MGND'}
POWER_NETS = GROUND_NETS | {'VIN_24V', '+24V_BED', '+24V_HEAT', '+24V_FAN', '+24V_MOT', '+24V_VMOT',
                            '+24V_SENS', '+5V', '+5V_KIT', '+3V3'}
KICAD_POWER = {'GND': 'power:GND', '+5V': 'power:+5V', '+3V3': 'power:+3V3'}

# footprint
FP_R = 'Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P10.16mm_Horizontal'
FP_R_05W = 'Resistor_THT:R_Axial_DIN0309_L9.0mm_D3.2mm_P12.70mm_Horizontal'
FP_C = 'Capacitor_THT:C_Disc_D5.0mm_W2.5mm_P5.00mm'
FP_CP_BIG = 'Capacitor_THT:CP_Radial_D13.0mm_P5.00mm'
FP_CP_MID = 'Capacitor_THT:CP_Radial_D8.0mm_P5.00mm'
FP_CP_SMALL = 'Capacitor_THT:CP_Radial_D5.0mm_P2.00mm'
FP_LED = 'LED_THT:LED_D3.0mm'
FP_D_SMALL = 'Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal'
FP_D_1A = 'Diode_THT:D_DO-41_SOD81_P10.16mm_Horizontal'
FP_D_BIG = 'Diode_THT:D_DO-201AD_P15.24mm_Horizontal'
FP_TO220 = 'Package_TO_SOT_THT:TO-220-3_Vertical'
FP_SOT23 = 'Package_TO_SOT_SMD:SOT-23'
FP_DIP8 = 'Package_DIP:DIP-8_W7.62mm'
FP_DIP4 = 'Package_DIP:DIP-4_W7.62mm'
FP_XH2 = 'Connector_JST:JST_XH_B2B-XH-A_1x02_P2.50mm_Vertical'
FP_XH3 = 'Connector_JST:JST_XH_B3B-XH-A_1x03_P2.50mm_Vertical'
FP_XH4 = 'Connector_JST:JST_XH_B4B-XH-A_1x04_P2.50mm_Vertical'
FP_TP = 'TestPoint:TestPoint_THTPad_D1.5mm_Drill0.7mm'
FP_JUMPER = 'Connector_PinHeader_2.54mm:PinHeader_1x02_P2.54mm_Vertical'
FP_STEPSTICK = 'Module:Pololu_Breakout-16_15.2x20.3mm'


# ---------------------------------------------------------------- project / sheet
class Project:
    def __init__(self):
        self.root_uuid = new_uuid()
        self.counters = {}
        self.custom = {}
        self.sheets = []
        self.intent = {}      # (ref, pin_number) -> net (tên đầy đủ)

    def next_ref(self, prefix):
        self.counters[prefix] = self.counters.get(prefix, 0) + 1
        n = self.counters[prefix]
        return f'{prefix}{n:02d}' if prefix.startswith('#') else f'{prefix}{n}'

    def symbol(self, lib_id):
        lib, name = lib_id.split(':', 1)
        if lib == 'corexy':
            return self.custom[name]
        return load_lib_symbol(lib, name)


class Part:
    def __init__(self, sheet, lib_id, prefix, value, fp, nets, desc=None, ref=None, props=None):
        self.sheet = sheet
        self.lib_id = lib_id
        self.sym = sheet.project.symbol(lib_id)
        self.pins = symbol_pins(self.sym)
        self.prefix = prefix
        self.value = value
        self.fp = fp
        self.nets = nets
        self.ref = ref
        self.props = props or {}
        self.x = self.y = None

    def pin(self, key):
        key = str(key)
        by_num = [p for p in self.pins if p['num'] == key]
        if by_num:
            return by_num[0]
        by_name = [p for p in self.pins if p['name'] == key]
        if len(by_name) != 1:
            raise KeyError(f'{self.lib_id}: chân "{key}" không có hoặc bị trùng')
        return by_name[0]


DIRS = {0: (-1, 0), 180: (1, 0), 90: (0, 1), 270: (0, -1)}


def label_len(net):
    if net is None:
        return 1.5
    if net in POWER_NETS:
        return 7.0
    return 1.1 * len(net.lstrip('.')) + 4.5


class Sheet:
    def __init__(self, project, fname, title, paper=('A3', 420, 297)):
        self.project = project
        self.fname = fname
        self.title = title
        self.paper = paper
        self.uuid = new_uuid()        # uuid của file sheet
        self.sym_uuid = new_uuid()    # uuid của sheet symbol trong root
        self.items = []
        self.libs = {}
        self.points = {}
        self.wires = []
        self.rows = []
        self.power_marks = []
        project.sheets.append(self)

    # --- mô tả
    def row(self, title):
        r = {'title': title, 'parts': []}
        self.rows.append(r)
        return r

    def add(self, row, lib_id, prefix, value, fp, nets, **kw):
        p = Part(self, lib_id, prefix, value, fp, nets, **kw)
        row['parts'].append(p)
        return p

    # --- tiện ích hình học
    @staticmethod
    def snap(v):
        return round(round(v / GRID) * GRID, 4)

    def _key(self, x, y):
        return (round(x, 3), round(y, 3))

    def _occupy(self, x, y, owner):
        k = self._key(x, y)
        old = self.points.get(k)
        if old is not None and old != owner:
            if not (old[0] == 'net' and owner[0] == 'net' and old[1] == owner[1]):
                raise RuntimeError(f'[{self.fname}] điểm {k} bị trùng: {old} và {owner}')
        for (x1, y1, x2, y2, wnet) in self.wires:
            if self._on_segment(x, y, x1, y1, x2, y2):
                if owner != ('net', wnet):
                    raise RuntimeError(f'[{self.fname}] điểm {k} ({owner}) nằm giữa dây của net {wnet}')
        self.points[k] = owner

    @staticmethod
    def _on_segment(x, y, x1, y1, x2, y2):
        eps = 1e-3
        if abs(x1 - x2) < eps and abs(x - x1) < eps:
            return min(y1, y2) + eps < y < max(y1, y2) - eps
        if abs(y1 - y2) < eps and abs(y - y1) < eps:
            return min(x1, x2) + eps < x < max(x1, x2) - eps
        return False

    # --- phần tử
    def _power_or_label(self, net, x, y, d):
        if net in POWER_NETS:
            lib_id = KICAD_POWER.get(net, 'corexy:' + net)
            ground = net in GROUND_NETS
            if ground:
                rot = {(0, 1): 0, (0, -1): 180, (1, 0): 90, (-1, 0): 270}[d]
            else:
                rot = {(0, -1): 0, (0, 1): 180, (-1, 0): 90, (1, 0): 270}[d]
            p = Part(self, lib_id, '#PWR', net, '', {})
            self._emit_symbol(p, x, y, rot, power=True)
            return
        self._label(net, x, y, d, glob=not net.startswith('.'))

    def _label(self, net, x, y, d, glob):
        ang = {(-1, 0): 180, (1, 0): 0, (0, -1): 90, (0, 1): 270}[d]
        just = 'right' if ang in (180, 270) else 'left'
        if not glob:
            self.items.append(['label', qs(net[1:]), ['at', x, y, ang],
                               ['effects', font(), ['justify', just, 'bottom']], ['uuid', Q(new_uuid())]])
        else:
            self.items.append(['global_label', qs(net), ['shape', 'passive'], ['at', x, y, ang],
                               ['fields_autoplaced', 'yes'], ['effects', font(), ['justify', just]],
                               ['uuid', Q(new_uuid())],
                               ['property', Q('Intersheetrefs'), Q('${INTERSHEET_REFS}'), ['at', x, y, 0],
                                ['effects', font(), ['justify', just], ['hide', 'yes']]]])

    def _connect(self, part, key, net):
        p = part.pin(key)
        px, py = part.x + p['x'], part.y - p['y']
        if net is None:
            self.items.append(['no_connect', ['at', px, py], ['uuid', Q(new_uuid())]])
            return
        if not part.ref.startswith('#'):
            full = net if not net.startswith('.') else f'/{self.fname}/{net[1:]}'
            self.project.intent[(part.ref, p['num'])] = full
        dx, dy = DIRS[p['a']]
        length = STUB
        if net in POWER_NETS and dx == 0:
            # so le power symbol đứng cạnh nhau để chữ không đè lên nhau
            for length in (STUB, 2 * STUB, 3 * STUB, 4 * STUB):
                ey = py + dy * length
                w = 1.1 * len(net) / 2 + 0.5
                if not any(abs(ox - px) < w + ow and abs(oy - ey) < 2.3 for ox, oy, ow in self.power_marks):
                    break
            self.power_marks.append((px, py + dy * length, 1.1 * len(net) / 2 + 0.5))
        ex, ey = px + dx * length, py + dy * length
        self._occupy(ex, ey, ('net', net))
        self.wires.append((px, py, ex, ey, net))
        for k, owner in self.points.items():
            if self._on_segment(k[0], k[1], px, py, ex, ey) and owner != ('net', net):
                raise RuntimeError(f'[{self.fname}] dây {part.ref}.{key} đè lên điểm {k} {owner}')
        self.items.append(['wire', ['pts', ['xy', px, py], ['xy', ex, ey]],
                           ['stroke', ['width', 0], ['type', 'default']], ['uuid', Q(new_uuid())]])
        if net in POWER_NETS and dx != 0:
            # chân nằm ngang: dùng global label cùng tên net nguồn cho gọn
            self._label(net, ex, ey, (dx, dy), glob=True)
        else:
            self._power_or_label(net, ex, ey, (dx, dy))

    def _emit_symbol(self, part, x, y, rot=0, power=False):
        part.x, part.y = x, y
        if part.ref is None:
            part.ref = self.project.next_ref(part.prefix)
        self.libs[part.lib_id] = part.sym
        if rot == 0 and not power:
            for p in part.pins:
                self._occupy(x + p['x'], y - p['y'], ('pin', part.ref, p['num']))
        u = new_uuid()
        props = []
        for c in part.sym:
            if not (isinstance(c, list) and c[0] == 'property'):
                continue
            name = str(c[1])
            at = find(c, 'at')
            eff = copy.deepcopy(find(c, 'effects'))
            # thư viện KiCad 10 đặt (hide yes) ngay trong property, file 9.0 cần nó trong effects
            if (find(c, 'hide') or (name not in ('Reference', 'Value'))) and not find(eff, 'hide'):
                eff.append(['hide', 'yes'])
            val = str(c[2])
            if name == 'Reference':
                val = part.ref
            elif name == 'Value':
                val = part.value
            elif name == 'Footprint':
                val = part.fp if part.fp is not None else val
            if name in part.props:
                val = part.props[name]
            lx, ly, la = float(at[1]), float(at[2]), float(at[3])
            if rot in (90, 270):
                lx, ly = (-ly, lx) if rot == 90 else (ly, -lx)
            node = ['property', Q(name), qs(val) if name in ('Reference', 'Value', 'Footprint') or name in part.props else c[2],
                    ['at', x + lx, y - ly, la], eff]
            if power and name == 'Reference':
                if not find(eff, 'hide'):
                    eff.append(['hide', 'yes'])
            props.append(node)
        for name, val in part.props.items():
            if not any(str(n[1]) == name for n in props):
                props.append(prop(name, val, x, y, hide=True))
        pins = []
        seen = set()
        for p in part.pins:
            if p['num'] in seen:
                continue
            seen.add(p['num'])
            pins.append(['pin', Q(p['num']), ['uuid', Q(new_uuid())]])
        node = ['symbol', ['lib_id', Q(part.lib_id)], ['at', x, y, rot], ['unit', 1],
                ['exclude_from_sim', 'no'], ['in_bom', 'no' if part.ref.startswith('#') else 'yes'], ['on_board', 'yes'],
                ['dnp', 'no'], ['uuid', Q(u)]] + props + pins + [
            ['instances', ['project', Q(PROJECT),
                           ['path', Q(f'/{self.project.root_uuid}/{self.sym_uuid}'),
                            ['reference', Q(part.ref)], ['unit', 1]]]]]
        self.items.append(node)

    def text(self, x, y, content, size=1.6, bold=False):
        eff = ['effects', ['font', ['size', size, size]] + ([['bold', 'yes']] if bold else []),
               ['justify', 'left', 'top']]
        self.items.append(['text', qs(content), ['exclude_from_sim', 'no'], ['at', x, y, 0], eff,
                           ['uuid', Q(new_uuid())]])

    # --- dàn trang
    def _extent(self, part):
        l = r = u = d = 2.54
        for p in part.pins:
            sx, sy = p['x'], -p['y']
            if p['num'] in part.nets or p['name'] in part.nets:
                net = part.nets.get(p['num'], part.nets.get(p['name']))
                ll = STUB + label_len(net) if net is not None else 1.5
            else:
                ll = 1.5
            dx, dy = DIRS[p['a']]
            l = max(l, -sx + (ll if dx < 0 else 0))
            r = max(r, sx + (ll if dx > 0 else 0))
            u = max(u, -sy + (ll if dy < 0 else 0))
            d = max(d, sy + (ll if dy > 0 else 0))
        # chừa chỗ cho chữ Reference/Value theo vị trí đặt sẵn trong thư viện
        for c in part.sym:
            if not (isinstance(c, list) and c[0] == 'property' and str(c[1]) in ('Reference', 'Value')):
                continue
            at = find(c, 'at')
            tx, ty, ta = float(at[1]), -float(at[2]), int(float(at[3]))
            text = part.value if str(c[1]) == 'Value' else part.prefix + '00'
            w = 1.05 * len(text) + 1.0
            if ta in (90, 270):
                l, r = max(l, -tx + 2.0), max(r, tx + 2.0)
                u, d = max(u, -ty + w / 2), max(d, ty + w / 2)
                continue
            if tx > 0.5:
                r = max(r, tx + w)
            elif tx < -0.5:
                l = max(l, -tx + w)
            else:
                l, r = max(l, w / 2), max(r, w / 2)
            u, d = max(u, -ty + 2.0), max(d, ty + 2.0)
        return l, r, u, d

    def layout(self):
        pname, W, H = self.paper
        x0, xmax = 20.0, W - 15.0
        y = 22.0
        self.text(x0, 8.0, self.title, size=3.0, bold=True)
        for row in self.rows:
            self.text(x0, y, row['title'], size=2.0, bold=True)
            y += 6.0
            ext = [self._extent(p) for p in row['parts']]
            line, x, lines = [], x0, []
            for p, e in zip(row['parts'], ext):
                wdt = e[0] + e[1] + 5.08
                if line and x + wdt > xmax:
                    lines.append(line)
                    line, x = [], x0
                line.append((p, e, x))
                x += wdt
            if line:
                lines.append(line)
            for line in lines:
                top = max(e[2] for _, e, _ in line)
                bot = max(e[3] for _, e, _ in line)
                cy = self.snap(y + top)
                for p, e, lx in line:
                    self._emit_symbol(p, self.snap(lx + e[0]), cy)
                for p, e, lx in line:
                    for key, net in p.nets.items():
                        self._connect(p, key, net)
                y = cy + bot + 5.0
            y += 4.0
        if y > H - 10:
            raise RuntimeError(f'[{self.fname}] tràn trang ({y:.0f}mm > {H}mm) — tăng khổ giấy')

    def to_sexpr(self, page_no):
        pname = self.paper[0]
        head = ['kicad_sch', ['version', 20250114], ['generator', Q('eeschema')], ['generator_version', Q('9.0')],
                ['uuid', Q(self.uuid)], ['paper', Q(pname)],
                ['title_block', ['title', qs(self.title)], ['date', Q(date.today().isoformat())], ['rev', Q('0.1')],
                 ['company', qs('CoreXY printer – bo điều khiển tự làm')],
                 ['comment', 1, qs('Sinh tự động bởi hardware/tools/gen_schematic.py')]],
                ['lib_symbols'] + list(self.libs.values())]
        return head + self.items + [['embedded_fonts', 'no']]


# ---------------------------------------------------------------- symbol riêng của project
def build_custom_symbols(prj):
    c = prj.custom
    for net in POWER_NETS - set(KICAD_POWER):
        c[net] = power_symbol(net, net in GROUND_NETS)

    for name, table in (('FK743M2_P2', FK743_P2), ('FK743M2_P3', FK743_P3)):
        left = [(table[n], str(n), 'passive') for n in range(1, 57, 2)]
        right = [(table[n], str(n), 'passive') for n in range(2, 57, 2)]
        c[name] = box_symbol(name, 'J', name, 'Connector_PinSocket_2.54mm:PinSocket_2x28_P2.54mm_Vertical',
                             f'Header {name[-2:]} của kit FANKE FK743M2-IIT6 (STM32H743IIT6)', left, right, width=17.78)

    c['DCDC_Buck_Module'] = box_symbol(
        'DCDC_Buck_Module', 'U', 'LM2596S module', '',
        'Module buck DC-DC (LM2596S / XL4015), chỉnh ra 5.2V trước khi lắp',
        [('IN+', '1', 'passive'), ('IN-', '2', 'passive')], [('OUT+', '3', 'passive'), ('OUT-', '4', 'passive')],
        width=15.24, pitch=5.08)

    # StepStick TMC2209 của MKS: dùng lại hình Pololu, đổi tên chân theo pinout MKS V2.0
    sym = load_lib_symbol('Driver_Motor', 'Pololu_Breakout_A4988')
    old = 'Pololu_Breakout_A4988'
    new = 'StepStick_TMC2209_MKS'
    sym[1] = Q('corexy:' + new)
    rename = {'8': ('VM', 'power_in'), '2': ('VIO', 'power_in'), '9': ('~{EN}', 'input'),
              '12': ('NC', 'no_connect'), '13': ('PDN_UART', 'bidirectional'), '14': ('CLK', 'input')}
    for part in sym:
        if isinstance(part, list) and part[0] == 'symbol':
            part[1] = Q(str(part[1]).replace(old + '_', new + '_', 1))
            for p in part:
                if isinstance(p, list) and p[0] == 'pin':
                    num = str(find(p, 'number')[1])
                    if num in rename:
                        find(p, 'name')[1] = qs(rename[num][0])
                        p[1] = rename[num][1]
        if isinstance(part, list) and part[0] == 'property':
            if str(part[1]) == 'Value':
                part[2] = Q('MKS_TMC2209_V2.0')
            elif str(part[1]) == 'Description':
                part[2] = qs('StepStick TMC2209 (MKS V2.0). DIAG là chân rời phía trên, nối bằng dây Dupont.')
            elif str(part[1]) == 'Datasheet':
                part[2] = Q('https://github.com/makerbase-mks/MKS-StepStick-Driver')
            elif str(part[1]) == 'ki_keywords':
                part[2] = Q('stepper driver TMC2209 stepstick')
    c[new] = sym


# ---------------------------------------------------------------- mô tả mạch
def R(sheet, row, value, n1, n2, fp=FP_R):
    return sheet.add(row, 'Device:R', 'R', value, fp, {'1': n1, '2': n2})


def C(sheet, row, value, n1, n2, fp=FP_C):
    return sheet.add(row, 'Device:C', 'C', value, fp, {'1': n1, '2': n2})


def CP(sheet, row, value, plus, minus, fp):
    return sheet.add(row, 'Device:C_Polarized', 'C', value, fp, {'1': plus, '2': minus})


def LED(sheet, row, anode, cathode, value='LED'):
    return sheet.add(row, 'Device:LED', 'D', value, FP_LED, {'A': anode, 'K': cathode})


def D(sheet, row, lib, value, fp, anode, cathode):
    return sheet.add(row, 'Device:' + lib, 'D', value, fp, {'A': anode, 'K': cathode})


def TP(sheet, row, net):
    return sheet.add(row, 'Connector:TestPoint', 'TP', net.lstrip('.'), FP_TP, {'1': net})


def sheet_power(prj):
    s = Sheet(prj, '01_Nguon', 'Nguồn 24V: bảo vệ, cầu chì, buck 5V, nối GND')
    r = s.row('Đầu vào 24V (XT60) + TVS + tụ bulk')
    s.add(r, 'Connector_Generic:Conn_01x02', 'J', 'XT60 (24V vào)', 'Connector_AMASS:AMASS_XT60-M_1x02_P7.20mm_Vertical',
          {'1': 'VIN_24V', '2': 'PGND'})
    s.add(r, 'Device:D_TVS', 'D', '1.5KE33CA', FP_D_BIG, {'1': 'VIN_24V', '2': 'PGND'})
    CP(s, r, '1000uF/35V', 'VIN_24V', 'PGND', FP_CP_BIG)
    C(s, r, '100nF/50V', 'VIN_24V', 'PGND')
    R(s, r, '10k', 'VIN_24V', '.LED_24V')
    LED(s, r, '.LED_24V', 'PGND', 'LED xanh (24V)')

    r = s.row('Chia nhánh cầu chì  (Bed 15A | Hotend+quạt 5A | Motor+logic 5A | quạt 2A | cảm biến PTC 0.5A)')
    s.add(r, 'Device:Fuse', 'F', '15A (ATO)', 'Fuse:Fuseholder_Blade_ATO_Littelfuse_Pudenz_2_Pin', {'1': 'VIN_24V', '2': '+24V_BED'})
    s.add(r, 'Device:Fuse', 'F', '5A (ATO)', 'Fuse:Fuseholder_Blade_ATO_Littelfuse_Pudenz_2_Pin', {'1': 'VIN_24V', '2': '+24V_HEAT'})
    s.add(r, 'Device:Fuse', 'F', '5A (ATO)', 'Fuse:Fuseholder_Blade_ATO_Littelfuse_Pudenz_2_Pin', {'1': 'VIN_24V', '2': '+24V_MOT'})
    s.add(r, 'Device:Fuse', 'F', '2A (Mini)', 'Fuse:Fuseholder_Blade_Mini_Keystone_3568', {'1': '+24V_HEAT', '2': '+24V_FAN'})
    s.add(r, 'Device:Polyfuse', 'F', 'PTC 0.5A', 'Fuse:Fuse_Bourns_MF-RG500', {'1': '+24V_MOT', '2': '+24V_SENS'})
    s.add(r, 'Device:FerriteBead', 'FB', 'Ferrite 5A', 'Ferrite_THT:LairdTech_28C0236-0JW-10', {'1': '+24V_MOT', '2': '+24V_VMOT'})
    CP(s, r, '100uF/35V', '+24V_VMOT', 'MGND', FP_CP_MID)
    C(s, r, '100nF/50V', '+24V_VMOT', 'MGND')

    r = s.row('Buck 24V -> 5.2V (module) + chống USB cấp ngược + LED báo nguồn')
    s.add(r, 'corexy:DCDC_Buck_Module', 'U', 'LM2596S module (chỉnh 5.2V)', '',
          {'1': '+24V_MOT', '2': 'GND', '3': '+5V', '4': 'GND'})
    CP(s, r, '470uF/10V', '+5V', 'GND', FP_CP_MID)
    s.add(r, 'Device:D_TVS', 'D', '1.5KE6.8CA', FP_D_BIG, {'1': '+5V', '2': 'GND'})
    D(s, r, 'D_Schottky', '1N5822 (SS34)', FP_D_BIG, '+5V', '+5V_KIT')
    C(s, r, '100nF', '+5V_KIT', 'GND')
    R(s, r, '1k', '+5V', '.LED_5V')
    LED(s, r, '.LED_5V', 'GND', 'LED xanh (5V)')
    R(s, r, '1k', '+3V3', '.LED_3V3')
    LED(s, r, '.LED_3V3', 'GND', 'LED xanh (3V3)')

    r = s.row('Đo điện áp 24V (ADC) + điểm nối GND hình sao')
    R(s, r, '100k 1%', '+24V_MOT', 'VIN_SENSE')
    R(s, r, '10k 1%', 'VIN_SENSE', 'GND')
    C(s, r, '100nF', 'VIN_SENSE', 'GND')
    s.add(r, 'Device:NetTie_2', 'NT', 'NetTie GND-PGND', 'NetTie:NetTie-2_THT_Pad1.0mm', {'1': 'GND', '2': 'PGND'})
    s.add(r, 'Device:NetTie_2', 'NT', 'NetTie GND-MGND', 'NetTie:NetTie-2_THT_Pad1.0mm', {'1': 'GND', '2': 'MGND'})

    r = s.row('Test point')
    for n in ('VIN_24V', '+5V', '+5V_KIT', '+3V3', 'GND', 'PGND', 'MGND'):
        TP(s, r, n)

    r = s.row('PWR_FLAG (báo cho ERC biết các net nguồn có nguồn cấp)')
    for n in ('VIN_24V', '+24V_BED', '+24V_HEAT', '+24V_FAN', '+24V_MOT', '+24V_VMOT', '+24V_SENS',
              '+5V', '+5V_KIT', '+3V3', 'GND', 'PGND', 'MGND'):
        s.add(r, 'power:PWR_FLAG', '#FLG', 'PWR_FLAG', '', {'1': n})
    return s


def sheet_mcu(prj):
    s = Sheet(prj, '02_MCU', 'Kit MCU FANKE FK743M2-IIT6 (STM32H743IIT6) cắm qua 2 header 2x28')
    power = {'GND': 'GND', '5V': '+5V_KIT', '3V3': '+3V3'}
    r = s.row('Header P2 (trái) và P3 (phải) của kit — chân không dùng đánh dấu X')
    for name, table in (('FK743M2_P2', FK743_P2), ('FK743M2_P3', FK743_P3)):
        nets = {}
        for num, sig in table.items():
            nets[str(num)] = power.get(sig, PINMAP.get(sig))
        s.add(r, 'corexy:' + name, 'J', name, None, nets)
    return s


def sheet_motors(prj):
    s = Sheet(prj, '03_Driver', 'Driver động cơ: A, B = TMC2209 (MKS V2.0, UART) | Z1, Z2, E = A4988',
              paper=('A2', 594, 420))
    r = s.row('A, B — TMC2209 MKS V2.0. Địa chỉ UART: A=0 (MS1=GND, MS2=GND), B=1 (MS1=3.3V, MS2=GND)')
    for axis, ms1, first in (('A', 'GND', True), ('B', '+3V3', False)):
        s.add(r, 'corexy:StepStick_TMC2209_MKS', 'U', f'MKS TMC2209 ({axis})', FP_STEPSTICK, {
            '9': 'XY_EN', '10': ms1, '11': 'GND', '12': None, '13': 'TMC_UART', '14': None,
            '15': f'{axis}_STEP', '16': f'{axis}_DIR', '2': '+3V3', '8': '+24V_VMOT', '1': 'MGND', '7': 'MGND',
            '3': f'.{axis}_1B', '4': f'.{axis}_1A', '5': f'.{axis}_2A', '6': f'.{axis}_2B'})
        s.add(r, 'Connector_Generic:Conn_01x04', 'J', f'Motor {axis} (2B 2A 1A 1B)', FP_XH4,
              {'1': f'.{axis}_2B', '2': f'.{axis}_2A', '3': f'.{axis}_1A', '4': f'.{axis}_1B'})
        CP(s, r, '100uF/35V', '+24V_VMOT', 'MGND', FP_CP_MID)
        C(s, r, '100nF/50V', '+24V_VMOT', 'MGND')
        s.add(r, 'Connector_Generic:Conn_01x02', 'J', f'DIAG {axis} (dây Dupont)', FP_JUMPER,
              {'1': f'{axis}_DIAG', '2': 'GND'})
        if first:
            R(s, r, '10k', '+3V3', 'XY_EN')
            R(s, r, '1k', 'TMC_UART_TX', 'TMC_UART')

    r = s.row('Z1, Z2, E — A4988 1/16 bước (rút jumper RESET-SLEEP nếu muốn cắm TMC2209 chế độ standalone)')
    for axis in ('Z1', 'Z2', 'E'):
        s.add(r, 'Driver_Motor:Pololu_Breakout_A4988', 'U', f'A4988 ({axis})', FP_STEPSTICK, {
            '9': f'{axis}_EN', '10': '+3V3', '11': '+3V3', '12': '+3V3', '13': f'.{axis}_RST', '14': f'.{axis}_SLP',
            '15': f'{axis}_STEP', '16': f'{axis}_DIR', '2': '+3V3', '8': '+24V_VMOT', '1': 'MGND', '7': 'MGND',
            '3': f'.{axis}_1B', '4': f'.{axis}_1A', '5': f'.{axis}_2A', '6': f'.{axis}_2B'})
        s.add(r, 'Connector_Generic:Conn_01x04', 'J', f'Motor {axis} (2B 2A 1A 1B)', FP_XH4,
              {'1': f'.{axis}_2B', '2': f'.{axis}_2A', '3': f'.{axis}_1A', '4': f'.{axis}_1B'})
        s.add(r, 'Jumper:Jumper_2_Open', 'JP', 'RESET-SLEEP', FP_JUMPER, {'1': f'.{axis}_RST', '2': f'.{axis}_SLP'})
        CP(s, r, '100uF/35V', '+24V_VMOT', 'MGND', FP_CP_MID)
        C(s, r, '100nF/50V', '+24V_VMOT', 'MGND')
        R(s, r, '10k', '+3V3', f'{axis}_EN')

    r = s.row('Test point')
    for n in ('A_STEP', 'A_DIR', 'B_STEP', 'B_DIR', 'Z1_STEP', 'Z2_STEP', 'E_STEP', 'TMC_UART'):
        TP(s, r, n)
    return s


def sheet_heaters(prj):
    s = Sheet(prj, '04_Heater', 'Heater: hotend + bàn nhiệt (IRLB3034 lái bởi TC4427 @5V) + ngắt an toàn bàn nhiệt')
    r = s.row('Mạch lái gate TC4427 #1 (hotend, bed) và #2 (ngắt an toàn bed, kênh B dự phòng)')
    for net_in, loc in (('HOTEND_PWM', '.HE_IN'), ('BED_PWM', '.BED_IN'), ('BED_SAFETY', '.SAFE_IN')):
        R(s, r, '100', net_in, loc)
        R(s, r, '10k', loc, 'GND')
    s.add(r, 'Driver_FET:TC4427xOA', 'U', 'TC4427CPA', FP_DIP8, {
        'IN_A': '.HE_IN', 'IN_B': '.BED_IN', 'OUT_A': '.HE_DRV', 'OUT_B': '.BED_DRV',
        '6': '+5V', '3': 'PGND', '1': None, '8': None})
    C(s, r, '1uF', '+5V', 'PGND')
    C(s, r, '100nF', '+5V', 'PGND')
    s.add(r, 'Driver_FET:TC4427xOA', 'U', 'TC4427CPA', FP_DIP8, {
        'IN_A': '.SAFE_IN', 'IN_B': 'PGND', 'OUT_A': '.SAFE_DRV', 'OUT_B': '.SPARE_DRV',
        '6': '+5V', '3': 'PGND', '1': None, '8': None})
    C(s, r, '1uF', '+5V', 'PGND')
    C(s, r, '100nF', '+5V', 'PGND')
    TP(s, r, '.SPARE_DRV')

    r = s.row('Hotend 24V 40-60W (cầu chì 5A)')
    R(s, r, '22', '.HE_DRV', '.HE_G')
    R(s, r, '10k', '.HE_G', 'PGND')
    s.add(r, 'Transistor_FET:Q_NMOS_GDS', 'Q', 'IRLB3034PbF', FP_TO220, {'G': '.HE_G', 'D': '.HE_NEG', 'S': 'PGND'})
    s.add(r, 'Connector_Generic:Conn_01x02', 'J', 'HOTEND (+24V, -)',
          'TerminalBlock_Phoenix:TerminalBlock_Phoenix_MKDS-1,5-2-5.08_1x02_P5.08mm_Horizontal',
          {'1': '+24V_HEAT', '2': '.HE_NEG'})
    D(s, r, 'D_Schottky', 'SB560 (SS54)', FP_D_BIG, '.HE_NEG', '+24V_HEAT')
    R(s, r, '4.7k', '+24V_HEAT', '.HE_LED')
    LED(s, r, '.HE_LED', '.HE_NEG', 'LED đỏ (hotend)')
    TP(s, r, '.HE_NEG')

    r = s.row('Bàn nhiệt 24V <=250W (cầu chì 15A): Q_PWM nối tiếp Q_SAFE phía GND')
    R(s, r, '22', '.BED_DRV', '.BED_G')
    R(s, r, '10k', '.BED_G', '.BED_MID')
    s.add(r, 'Transistor_FET:Q_NMOS_GDS', 'Q', 'IRLB3034PbF (PWM)', FP_TO220, {'G': '.BED_G', 'D': '.BED_NEG', 'S': '.BED_MID'})
    R(s, r, '100k', '.BED_MID', 'PGND')
    R(s, r, '22', '.SAFE_DRV', '.SAFE_G')
    R(s, r, '10k', '.SAFE_G', 'PGND')
    s.add(r, 'Transistor_FET:Q_NMOS_GDS', 'Q', 'IRLB3034PbF (SAFETY)', FP_TO220, {'G': '.SAFE_G', 'D': '.BED_MID', 'S': 'PGND'})
    s.add(r, 'Connector_Generic:Conn_01x02', 'J', 'BED (+24V, -)',
          'TerminalBlock_RND:TerminalBlock_RND_205-00067_1x02_P7.50mm_Horizontal',
          {'1': '+24V_BED', '2': '.BED_NEG'})
    D(s, r, 'D_Schottky', 'SB560 (SS54)', FP_D_BIG, '.BED_NEG', '+24V_BED')
    CP(s, r, '10uF/35V', '+24V_BED', 'PGND', FP_CP_SMALL)
    R(s, r, '4.7k', '+24V_BED', '.BED_LED')
    LED(s, r, '.BED_LED', '.BED_NEG', 'LED đỏ (bed)')
    TP(s, r, '.BED_NEG')
    TP(s, r, '.BED_MID')
    return s


def sheet_fans(prj):
    s = Sheet(prj, '05_Quat', 'Quạt 24V 2 dây: làm mát chi tiết (PWM), tản nhiệt hotend (bật/tắt), quạt bo (luôn bật)')
    for title, sig, tag in (('Quạt làm mát chi tiết in — PWM', 'PART_FAN_PWM', 'PF'),
                            ('Quạt tản nhiệt hotend — bật/tắt theo nhiệt độ hotend', 'HOTEND_FAN_EN', 'HF')):
        r = s.row(title)
        R(s, r, '100', sig, f'.{tag}_G')
        R(s, r, '100k', f'.{tag}_G', 'PGND')
        s.add(r, 'Transistor_FET:AO3400A', 'Q', 'AO3400A', FP_SOT23, {'G': f'.{tag}_G', 'D': f'.{tag}_NEG', 'S': 'PGND'})
        s.add(r, 'Connector_Generic:Conn_01x02', 'J', f'FAN {tag} (+24V, -)', FP_XH2, {'1': '+24V_FAN', '2': f'.{tag}_NEG'})
        D(s, r, 'D_Schottky', '1N5819 (SS14)', FP_D_1A, f'.{tag}_NEG', '+24V_FAN')
        R(s, r, '4.7k', '+24V_FAN', f'.{tag}_LED')
        LED(s, r, f'.{tag}_LED', f'.{tag}_NEG', 'LED xanh')
    r = s.row('Quạt làm mát bo mạch — luôn bật')
    s.add(r, 'Connector_Generic:Conn_01x02', 'J', 'FAN BOARD (+24V, -)', FP_XH2, {'1': '+24V_FAN', '2': 'PGND'})
    return s


def sheet_thermistors(prj):
    s = Sheet(prj, '06_NTC', 'Đo nhiệt độ NTC 100k B3950 (mạch giống SKR 2 / Octopus / Prusa Buddy)')
    for name, net in (('Hotend', 'TH_HOTEND'), ('Bàn nhiệt', 'TH_BED'), ('Dự phòng', 'TH_SPARE')):
        tag = net[3:]
        r = s.row(f'NTC {name}: 4.7k pull-up 3.3V, 2x2.37k nối tiếp, 2 diode kẹp, 100nF')
        s.add(r, 'Connector_Generic:Conn_01x02', 'J', f'NTC {tag}', FP_XH2, {'1': f'.{tag}_RAW', '2': 'GND'})
        R(s, r, '4.7k 1%', '+3V3', f'.{tag}_RAW')
        R(s, r, '2.37k 1%', f'.{tag}_RAW', f'.{tag}_MID')
        D(s, r, 'D', '1N4148', FP_D_SMALL, f'.{tag}_MID', '+3V3')
        D(s, r, 'D', '1N4148', FP_D_SMALL, 'GND', f'.{tag}_MID')
        R(s, r, '2.37k 1%', f'.{tag}_MID', net)
        C(s, r, '100nF', net, 'GND')
    return s


def sheet_io(prj):
    s = Sheet(prj, '07_IO', 'Cảm biến homing NPN 24V (cách ly PC817), cảm biến hết nhựa, UART cho SBC')
    for sig, tag in (('X_HOME', 'X'), ('Y_HOME', 'Y'), ('Z_PROBE', 'Z')):
        r = s.row(f'Homing {tag} — cảm biến tiệm cận NPN (nâu +24V, xanh GND, đen tín hiệu)')
        s.add(r, 'Connector_Generic:Conn_01x03', 'J', f'SENSOR {tag} (+24V, GND, SIG)', FP_XH3,
              {'1': '+24V_SENS', '2': 'PGND', '3': f'.{tag}_SIG'})
        s.add(r, 'Device:R', 'R', '1.5k 0.5W', FP_R_05W, {'1': '+24V_SENS', '2': f'.{tag}_LEDA'})
        LED(s, r, f'.{tag}_LEDA', f'.{tag}_OPTA', 'LED đỏ')
        s.add(r, 'Isolator:PC817', 'U', 'PC817', FP_DIP4,
              {'1': f'.{tag}_OPTA', '2': f'.{tag}_SIG', '3': 'GND', '4': f'.{tag}_OC'})
        # 1N4148 song song ngược với cả LED báo + LED opto: cắm ngược 24V thì cả 2 LED đều được bảo vệ
        D(s, r, 'D', '1N4148', FP_D_SMALL, f'.{tag}_SIG', f'.{tag}_LEDA')
        R(s, r, '10k', '+3V3', f'.{tag}_OC')
        R(s, r, '1k', f'.{tag}_OC', sig)
        C(s, r, '100nF', sig, 'GND')
        TP(s, r, sig)

    r = s.row('Cảm biến hết nhựa (công tắc 3 chân, nguồn 5V, tín hiệu kéo lên 3.3V)')
    s.add(r, 'Connector_Generic:Conn_01x03', 'J', 'FILAMENT (5V, GND, SIG)', FP_XH3,
          {'1': '+5V', '2': 'GND', '3': '.FIL_SIG'})
    R(s, r, '10k', '+3V3', '.FIL_SIG')
    R(s, r, '1k', '.FIL_SIG', 'FIL_RUNOUT')
    C(s, r, '100nF', 'FIL_RUNOUT', 'GND')

    r = s.row('UART cho máy tính nhúng (SBC) sau này — UART4: TX của MCU nối RX của SBC')
    s.add(r, 'Connector_Generic:Conn_01x03', 'J', 'SBC UART (TX, RX, GND)', FP_XH3,
          {'1': 'SBC_TX', '2': 'SBC_RX', '3': 'GND'})
    return s


# ---------------------------------------------------------------- ghi file
def write_root(prj):
    items = []
    x, y = 25.4, 50.8
    for i, s in enumerate(prj.sheets):
        col, row = i % 4, i // 4
        sx, sy = x + col * 96.52, y + row * 45.72
        items.append(['sheet', ['at', sx, sy], ['size', 76.2, 25.4], ['exclude_from_sim', 'no'], ['in_bom', 'yes'],
                      ['on_board', 'yes'], ['dnp', 'no'], ['fields_autoplaced', 'yes'],
                      ['stroke', ['width', 0.1524], ['type', 'solid']], ['fill', ['color', 0, 0, 0, 0.0]],
                      ['uuid', Q(s.sym_uuid)],
                      ['property', Q('Sheetname'), qs(s.fname), ['at', sx, sy - 0.7, 0],
                       ['effects', font(1.5), ['justify', 'left', 'bottom']]],
                      ['property', Q('Sheetfile'), qs(s.fname + '.kicad_sch'), ['at', sx, sy + 26.0, 0],
                       ['effects', font(1.27), ['justify', 'left', 'top']]],
                      ['instances', ['project', Q(PROJECT), ['path', Q('/' + prj.root_uuid), ['page', Q(str(i + 2))]]]]])
        items.append(['text', qs(s.title), ['exclude_from_sim', 'no'], ['at', sx + 2.0, sy + 3.0, 0],
                      ['effects', font(1.27), ['justify', 'left', 'top']], ['uuid', Q(new_uuid())]])

    pin_lines = ['GÁN CHÂN MCU (STM32H743IIT6 trên kit FK743M2-IIT6)', '']
    for pin, net in PINMAP.items():
        note = PINMAP_NOTE.get(net, '')
        pin_lines.append(f'{pin:<5} -> {net}' + (f'   ({note})' if note else ''))
    notes = '\n'.join([
        'QUYẾT ĐỊNH THIẾT KẾ (chi tiết: docs/01_kinh_nghiem_tu_mach_tham_khao.md, mục 9)',
        '',
        '- Nguồn 24V qua XT60. 3 nhánh cầu chì: bed 15A / hotend+quạt 5A / motor+logic 5A.',
        '- 3 net GND: GND (logic), PGND (công suất), MGND (motor) nối 1 điểm bằng NetTie ở trang Nguồn.',
        '- Buck module 5.2V -> 1N5822 -> 5V của kit (chống USB cấp ngược vào máy tính).',
        '- Heater: IRLB3034 lái bởi TC4427 @5V. Bed có MOSFET an toàn nối tiếp (BED_SAFETY mặc định TẮT).',
        '- Driver: A, B = MKS TMC2209 V2.0 (UART PDN, địa chỉ 0/1). Z1, Z2, E = A4988 1/16 bước.',
        '- Homing X/Y/Z: cảm biến tiệm cận NPN 24V, cách ly PC817. Logic MCU: kích hoạt = mức THẤP.',
        '- Quạt 2 dây: part fan PWM, hotend fan bật/tắt, quạt bo luôn bật.',
        '',
        'Lưu ý khi lắp bo thử:',
        '- Chỉnh áp ra buck 5.2V TRƯỚC khi nối vào mạch.',
        '- Chỉnh Vref A4988 Z1 và Z2 bằng nhau.',
        '- AO3400A là SOT-23 (SMD): hàn lên đế chuyển SOT-23 sang DIP.',
        '- Symbol linh kiện THT thay cho bản SMD dự kiến trên PCB: 1.5KE33CA~SMBJ28A, 1N5822~SS34, SB560~SS54, 1N5819~SS14.',
    ])
    items.append(['text', qs(notes), ['exclude_from_sim', 'no'], ['at', 25.4, 150.0, 0],
                  ['effects', font(1.6), ['justify', 'left', 'top']], ['uuid', Q(new_uuid())]])
    items.append(['text', qs('\n'.join(pin_lines)), ['exclude_from_sim', 'no'], ['at', 250.0, 150.0, 0],
                  ['effects', font(1.6), ['justify', 'left', 'top']], ['uuid', Q(new_uuid())]])
    items.append(['text', qs('BO ĐIỀU KHIỂN MÁY IN 3D COREXY — STM32H743 + 2xTMC2209 + 3xA4988 — 24V'),
                  ['exclude_from_sim', 'no'], ['at', 25.4, 25.4, 0],
                  ['effects', ['font', ['size', 4, 4], ['bold', 'yes']], ['justify', 'left', 'top']],
                  ['uuid', Q(new_uuid())]])
    root = ['kicad_sch', ['version', 20250114], ['generator', Q('eeschema')], ['generator_version', Q('9.0')],
            ['uuid', Q(prj.root_uuid)], ['paper', Q('A3')],
            ['title_block', ['title', qs('Bo điều khiển máy in 3D CoreXY')], ['date', Q(date.today().isoformat())],
             ['rev', Q('0.1')], ['comment', 1, qs('Sinh tự động bởi hardware/tools/gen_schematic.py')]],
            ['lib_symbols']] + items + [['sheet_instances', ['path', Q('/'), ['page', Q('1')]]], ['embedded_fonts', 'no']]
    return root


def main():
    os.makedirs(OUT, exist_ok=True)
    prj = Project()
    build_custom_symbols(prj)
    builders = [sheet_power, sheet_mcu, sheet_motors, sheet_heaters, sheet_fans, sheet_thermistors, sheet_io]
    for b in builders:
        b(prj)
    for s in prj.sheets:
        s.layout()
    for i, s in enumerate(prj.sheets):
        with open(os.path.join(OUT, s.fname + '.kicad_sch'), 'w', encoding='utf-8') as f:
            f.write(ser(s.to_sexpr(i + 2)) + '\n')
    with open(os.path.join(OUT, PROJECT + '.kicad_sch'), 'w', encoding='utf-8') as f:
        f.write(ser(write_root(prj)) + '\n')

    lib = ['kicad_symbol_lib', ['version', 20241209], ['generator', Q('kicad_symbol_editor')],
           ['generator_version', Q('9.0')]]
    for name, sym in sorted(prj.custom.items()):
        sym = copy.deepcopy(sym)
        sym[1] = Q(name)
        lib.append(sym)
    with open(os.path.join(OUT, 'corexy.kicad_sym'), 'w', encoding='utf-8') as f:
        f.write(ser(lib) + '\n')
    with open(os.path.join(OUT, 'sym-lib-table'), 'w', encoding='utf-8') as f:
        f.write('(sym_lib_table\n\t(version 7)\n\t(lib (name "corexy")(type "KiCad")(uri "${KIPRJMOD}/corexy.kicad_sym")'
                '(options "")(descr "Symbol riêng của bo CoreXY"))\n)\n')
    pro = os.path.join(OUT, PROJECT + '.kicad_pro')
    if not os.path.exists(pro):
        with open(pro, 'w', encoding='utf-8') as f:
            json.dump({'meta': {'filename': PROJECT + '.kicad_pro', 'version': 3},
                       'sheets': [[prj.root_uuid, 'Root']] + [[s.sym_uuid, s.fname] for s in prj.sheets]}, f, indent=2)

    with open(os.path.join(HERE, 'intent_netlist.json'), 'w', encoding='utf-8') as f:
        json.dump({f'{r}.{p}': n for (r, p), n in sorted(prj.intent.items())}, f, indent=1, ensure_ascii=False)
    print('Đã ghi', len(prj.sheets) + 1, 'trang schematic vào', OUT)
    print('Số kết nối chân:', len(prj.intent))


if __name__ == '__main__':
    main()
