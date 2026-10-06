#!/usr/bin/env python3
"""Sinh hình minh hoạ cho tài liệu đào tạo CoreXY."""
import math, os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyArrowPatch, Rectangle, Arc

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 9,
    "axes.edgecolor": "#5A6862", "axes.labelcolor": "#1A1A1A",
    "text.color": "#1A1A1A", "xtick.color": "#5A6862", "ytick.color": "#5A6862",
    "figure.dpi": 160, "savefig.bbox": "tight", "savefig.facecolor": "white",
})
A_COL, B_COL, AM, INK, MUT = "#0B7F88", "#C93B52", "#D99A00", "#1A1A1A", "#8899A0"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figures")
os.makedirs(OUT, exist_ok=True)

def save(fig, name):
    p = os.path.join(OUT, name)
    fig.savefig(p)
    plt.close(fig)
    print(name)

# --- H1: xung STEP/DIR và vị trí động cơ ------------------------------
fig, ax = plt.subplots(2, 1, figsize=(6.6, 2.9), sharex=True,
                       gridspec_kw={"height_ratios": [1, 1.1], "hspace": 0.25})
t = np.linspace(0, 10, 2000)
step = np.zeros_like(t)
edges = [1, 2, 3, 4, 5, 6.5, 8, 9.5]
for e in edges:
    step[(t >= e) & (t < e + 0.18)] = 1
ax[0].plot(t, step, color=A_COL, lw=1.6)
ax[0].set_ylim(-0.3, 1.5); ax[0].set_yticks([0, 1]); ax[0].set_yticklabels(["0 V", "3.3 V"])
ax[0].set_ylabel("STEP")
ax[0].annotate("mỗi xung = 1 vi bước", xy=(1.1, 1.05), xytext=(1.6, 1.3),
               arrowprops=dict(arrowstyle="->", color=MUT, lw=0.8), fontsize=8, color=MUT)
ax[0].annotate("xung thưa dần = chạy chậm lại", xy=(8.0, 1.05), xytext=(5.6, 1.3),
               arrowprops=dict(arrowstyle="->", color=MUT, lw=0.8), fontsize=8, color=MUT)
pos = np.zeros_like(t)
for i, e in enumerate(edges):
    pos[t >= e] = i + 1
ax[1].step(t, pos, color=INK, lw=1.4, where="post")
ax[1].set_ylabel("vị trí\n(vi bước)"); ax[1].set_xlabel("thời gian")
for a in ax:
    a.spines[["top", "right"]].set_visible(False)
    a.set_xticks([])
save(fig, "fig_step_dir.png")

# --- H2: vi bước: dòng trong hai cuộn dây -----------------------------
fig, ax = plt.subplots(figsize=(6.6, 2.4))
th = np.linspace(0, 2 * np.pi, 400)
ax.plot(th, np.cos(th), color=A_COL, lw=1.6, label="dòng cuộn 1")
ax.plot(th, np.sin(th), color=B_COL, lw=1.6, label="dòng cuộn 2")
k = np.arange(0, 17)
ax.plot(k * 2 * np.pi / 16, np.cos(k * 2 * np.pi / 16), "o", color=A_COL, ms=3.5)
ax.plot(k * 2 * np.pi / 16, np.sin(k * 2 * np.pi / 16), "o", color=B_COL, ms=3.5)
ax.axhline(0, color=MUT, lw=0.6)
ax.set_xticks([0, np.pi / 2, np.pi, 3 * np.pi / 2, 2 * np.pi])
ax.set_xticklabels(["0", "4 nấc", "8 nấc", "12 nấc", "16 nấc = 1 nấc cơ khí"])
ax.set_ylabel("dòng điện"); ax.legend(frameon=False, fontsize=8, loc="upper right")
ax.set_title("16 vi bước chia nhỏ một nấc cơ khí: mỗi chấm là một xung STEP", fontsize=9)
ax.spines[["top", "right"]].set_visible(False)
save(fig, "fig_microstep.png")

# --- H3: cơ cấu CoreXY ------------------------------------------------
fig, ax = plt.subplots(figsize=(5.6, 4.8))
W = H = 10
gy, hx = 5.6, 5.0
# khung
ax.add_patch(Rectangle((0, 0), W, H, fill=False, ec="#C9D2CF", lw=1.6))
# thanh ngang truot theo Y
ax.plot([0, W], [gy, gy], color="#B9C4BE", lw=8, solid_capstyle="round", zorder=2)
# dai A: motor A (goc tren trai) -> canh trai xuong goc duoi -> len gantry -> dau in
ax.plot([0.55, 0.55, 1.15, 1.15, hx], [H - 0.55, 0.55, 0.55, gy + 0.35, gy + 0.35],
        color=A_COL, lw=1.7, zorder=3, solid_joinstyle="round")
# dai A nhanh kia: motor A -> canh tren -> goc tren phai -> xuong gantry -> dau in
ax.plot([0.55, W - 0.55, W - 0.55, hx], [H - 0.9, H - 0.9, gy + 0.35, gy + 0.35],
        color=A_COL, lw=1.7, zorder=3, solid_joinstyle="round", alpha=0.75)
# dai B doi xung guong
ax.plot([W - 0.55, W - 0.55, W - 1.15, W - 1.15, hx], [H - 0.55, 0.55, 0.55, gy - 0.35, gy - 0.35],
        color=B_COL, lw=1.7, zorder=3, solid_joinstyle="round")
ax.plot([W - 0.55, 0.55, 0.55, hx], [H - 1.25, H - 1.25, gy - 0.35, gy - 0.35],
        color=B_COL, lw=1.7, zorder=3, solid_joinstyle="round", alpha=0.75)
# motor
for x, c, lab, ha in [(0.55, A_COL, "motor A", "left"), (W - 0.55, B_COL, "motor B", "right")]:
    ax.add_patch(Rectangle((x - 0.75, H - 0.55 - 0.75), 1.5, 1.5, fc="white", ec=INK, lw=1.2, zorder=4))
    ax.plot([x], [H - 0.55], "o", color=c, ms=10, zorder=5)
    ax.text(x, H + 0.85, lab, ha="center", fontsize=9.5, color=c, weight="bold")
# puly goc
for x, y in [(1.15, 0.55), (W - 1.15, 0.55)]:
    ax.plot([x], [y], "o", mfc="white", mec=MUT, ms=6, zorder=5)
# dau in
ax.add_patch(Rectangle((hx - 0.75, gy - 0.6), 1.5, 1.2, fc=AM, ec="none", zorder=6))
ax.text(hx, gy - 1.25, "đầu in", ha="center", fontsize=9, color=INK)
# truc
ax.annotate("", xy=(hx + 2.4, gy), xytext=(hx + 0.95, gy),
            arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.4))
ax.text(hx + 2.6, gy, "X", fontsize=11, va="center", weight="bold")
ax.annotate("", xy=(hx, gy + 2.3), xytext=(hx, gy + 0.85),
            arrowprops=dict(arrowstyle="-|>", color=INK, lw=1.4))
ax.text(hx, gy + 2.6, "Y", fontsize=11, ha="center", weight="bold")
ax.text(1.6, 3.0, "đai A", color=A_COL, fontsize=9, weight="bold")
ax.text(W - 2.7, 3.0, "đai B", color=B_COL, fontsize=9, weight="bold")
ax.text(W / 2, -1.0, "Hai motor gắn cố định trên khung. Thanh ngang trượt theo Y,",
        ha="center", fontsize=8.5, color=MUT)
ax.text(W / 2, -1.7, "đầu in trượt theo X trên thanh ngang. Mỗi đai nối cả hai.",
        ha="center", fontsize=8.5, color=MUT)
ax.set_xlim(-1.6, W + 2.6); ax.set_ylim(-2.3, H + 1.8); ax.axis("off")
save(fig, "fig_corexy.png")

# --- H4: bốn chuyển động cơ bản --------------------------------------
fig, axs = plt.subplots(1, 4, figsize=(7.4, 2.3))
cases = [("+X", 1, 0), ("+Y", 0, 1), ("chéo ↗", 1, 1), ("chéo ↘", 1, -1)]
for ax, (name, dx, dy) in zip(axs, cases):
    da, db = dx + dy, dx - dy
    ax.annotate("", xy=(dx, dy), xytext=(0, 0),
                arrowprops=dict(arrowstyle="-|>", color=AM, lw=2.4))
    ax.set_xlim(-1.5, 1.5); ax.set_ylim(-1.5, 1.6)
    ax.axhline(0, color="#DDE4E2", lw=0.8); ax.axvline(0, color="#DDE4E2", lw=0.8)
    ax.set_xticks([]); ax.set_yticks([]); ax.set_aspect("equal")
    for s in ax.spines.values(): s.set_visible(False)
    ax.set_title(name, fontsize=10, pad=2)
    txt = f"ΔA = {da:+d}\nΔB = {db:+d}"
    sub = "cả hai quay" if abs(da) == abs(db) else ("chỉ A quay" if db == 0 else "chỉ B quay")
    ax.text(0, -1.45, txt, ha="center", fontsize=8.5, color=INK, linespacing=1.4)
    ax.text(0, 1.25, sub, ha="center", fontsize=8, color=MUT)
save(fig, "fig_four_moves.png")

# --- H5: hình vuông trong XY và ảnh của nó trong AB -------------------
fig, axs = plt.subplots(1, 2, figsize=(7.0, 3.1))
sq = np.array([[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]], float)
axs[0].plot(sq[:, 0], sq[:, 1], color=AM, lw=2, marker="o", ms=4)
axs[0].set_title("Đầu in trong mặt phẳng XY", fontsize=9.5)
axs[0].set_xlabel("X (mm)"); axs[0].set_ylabel("Y (mm)")
ab = np.stack([sq[:, 0] + sq[:, 1], sq[:, 0] - sq[:, 1]], 1)
axs[1].plot(ab[:, 0], ab[:, 1], color=A_COL, lw=2, marker="o", ms=4)
axs[1].set_title("Cùng đường đó, nhìn bằng toạ độ motor A và B", fontsize=9.5)
axs[1].set_xlabel("A = X + Y"); axs[1].set_ylabel("B = X − Y")
for ax in axs:
    ax.set_aspect("equal"); ax.grid(color="#EDF1F0"); ax.set_axisbelow(True)
    ax.spines[["top", "right"]].set_visible(False)
save(fig, "fig_xy_ab.png")

# --- H6: Bresenham ----------------------------------------------------
dA, dB = 8, 3
n = max(dA, dB)
ea = eb = n // 2
rows = []
for i in range(1, n + 1):
    ea += dA; sa = ea >= n
    if sa: ea -= n
    eb += dB; sb = eb >= n
    if sb: eb -= n
    rows.append((i, sa, sb, ea, eb))
fig, ax = plt.subplots(figsize=(6.8, 2.6))
for i, sa, sb, _, _ in rows:
    if sa: ax.plot([i, i], [1.05, 1.45], color=A_COL, lw=3, solid_capstyle="butt")
    if sb: ax.plot([i, i], [0.05, 0.45], color=B_COL, lw=3, solid_capstyle="butt")
ax.plot(range(1, n + 1), [r[3] / n + 1.55 for r in rows], "o-", color=A_COL, ms=3, lw=0.9, alpha=.55)
ax.plot(range(1, n + 1), [r[4] / n + 0.55 for r in rows], "o-", color=B_COL, ms=3, lw=0.9, alpha=.55)
ax.set_yticks([0.25, 0.8, 1.25, 1.8])
ax.set_yticklabels(["xung B", "err_b", "xung A", "err_a"], fontsize=8.5)
ax.set_xticks(range(1, n + 1)); ax.set_xlabel("nhịp timer")
ax.set_xlim(0.3, n + .7); ax.set_ylim(-0.1, 2.3)
ax.set_title(f"ΔA = {dA} bước, ΔB = {dB} bước, n = {n} nhịp: A bước mọi nhịp, B bước 3 lần, rải đều",
             fontsize=9)
ax.spines[["top", "right", "left"]].set_visible(False)
save(fig, "fig_bresenham.png")

# --- H7: hình thang và tam giác --------------------------------------
def profile(n, tpm, length, speed, accel, MIN=25, START=2000):
    vmax = speed * tpm; a = accel * tpm
    c_min = max(int(1e6 / vmax), MIN)
    ramp = min(int(vmax * vmax / (2 * a)), n // 2)
    c0 = min(max(int(1e6 * math.sqrt(2 / a)), c_min), START)
    c, rest, left, cs, ts, T = c0, 0, n, [], [], 0.0
    cruise_from = n - ramp
    while left:
        cs.append(1e6 / c / tpm); ts.append(T); T += c / 1e6; left -= 1
        if left == 0: break
        i = n - left
        if left > cruise_from:
            num = 2 * c + rest; den = 4 * i + 1; c = max(c - num // den, c_min); rest = num % den
        elif left <= ramp:
            num = 2 * c + rest; den = 4 * left + 1; c = min(c + num // den, START); rest = num % den
        else:
            c, rest = c_min, 0
    return np.array(ts), np.array(cs)

fig, axs = plt.subplots(1, 2, figsize=(7.2, 2.6), sharey=True)
t1, v1 = profile(8000, 80, 100, 150, 2000)
axs[0].plot(t1 * 1000, v1, color=A_COL, lw=1.8)
axs[0].set_title("Đoạn 100 mm: đủ dài, hình thang", fontsize=9.5)
t2, v2 = profile(160, 80, 2, 150, 2000)
axs[1].plot(t2 * 1000, v2, color=B_COL, lw=1.8)
axs[1].axhline(150, color=MUT, ls="--", lw=0.9)
axs[1].text(25, 155, "tốc độ đặt 150 mm/s, không bao giờ đạt được", fontsize=8, color=MUT, ha="center")
axs[1].set_title("Đoạn 2 mm: quá ngắn, thành tam giác", fontsize=9.5)
for ax in axs:
    ax.set_xlabel("thời gian (ms)"); ax.grid(color="#EDF1F0"); ax.set_axisbelow(True)
    ax.spines[["top", "right"]].set_visible(False)
axs[0].set_ylabel("tốc độ đầu in (mm/s)")
save(fig, "fig_trapezoid.png")

# --- H8: dãy chu kỳ c_n ----------------------------------------------
a = 160000.0
c = 2000; rest = 0; cs = [c]
for i in range(1, 460):
    num = 2 * c + rest; den = 4 * i + 1; d = num // den; rest = num % den
    c = max(c - d, 83); cs.append(c)
fig, ax = plt.subplots(figsize=(6.6, 2.4))
ax.plot(cs, color=A_COL, lw=1.6, label="c tính bằng truy hồi số nguyên (ISR)")
exact = [1e6 * math.sqrt(2 / a) * (math.sqrt(n + 1) - math.sqrt(n)) for n in range(1, 461)]
ax.plot(exact, color=MUT, lw=1.0, ls="--", label="công thức chính xác, có căn bậc hai")
ax.axhline(83, color=B_COL, lw=1.0, ls=":")
ax.text(300, 110, "c_min = 83 µs, tương ứng 150 mm/s", fontsize=8, color=B_COL)
ax.set_xlabel("bước thứ i"); ax.set_ylabel("chu kỳ c (µs)")
ax.legend(frameon=False, fontsize=8)
ax.set_ylim(0, 2100)
ax.spines[["top", "right"]].set_visible(False)
save(fig, "fig_cn.png")

# --- H9: lookahead ----------------------------------------------------
fig, ax = plt.subplots(figsize=(6.8, 2.6))
seg = 5.0; N = 20; A_ = 2000.0; V = 150.0
xs, ys = [], []
x = 0.0
for k in range(N):
    ent = 0.0 if k == 0 else V
    ex = 0.0 if k == N - 1 else V
    s = np.linspace(0, seg, 60)
    v = np.minimum(np.sqrt(ent ** 2 + 2 * A_ * s), np.sqrt(ex ** 2 + 2 * A_ * (seg - s)))
    v = np.minimum(v, V)
    xs.extend(x + s); ys.extend(v); x += seg
ax.plot(xs, ys, color=A_COL, lw=1.8, label="có lookahead: 728 ms")
xs2, ys2 = [], []
x = 0.0
for k in range(N):
    s = np.linspace(0, seg, 60)
    v = np.minimum(np.sqrt(2 * A_ * s), np.sqrt(2 * A_ * (seg - s)))
    v = np.minimum(v, V)
    xs2.extend(x + s); ys2.extend(v); x += seg
ax.plot(xs2, ys2, color=B_COL, lw=1.2, label="dừng ở mỗi điểm nối: 1633 ms")
for k in range(1, N):
    ax.axvline(k * seg, color="#E8EDEC", lw=0.7, zorder=0)
ax.set_xlabel("quãng đường (mm), 100 mm chia thành 20 đoạn")
ax.set_ylabel("tốc độ (mm/s)")
ax.legend(frameon=False, fontsize=8, loc="lower center")
ax.spines[["top", "right"]].set_visible(False)
save(fig, "fig_lookahead.png")

# --- H10: junction deviation -----------------------------------------
fig, axs = plt.subplots(1, 3, figsize=(7.2, 2.4))
angles = [(170, "góc tù, gần thẳng"), (90, "góc vuông"), (20, "góc nhọn")]
for ax, (deg, lab) in zip(axs, angles):
    th = math.radians(deg)
    p0 = np.array([-1, 0]); p1 = np.array([0, 0])
    p2 = np.array([math.cos(math.pi - th), math.sin(math.pi - th)])
    ax.plot([p0[0], p1[0]], [p0[1], p1[1]], color=INK, lw=1.6)
    ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=INK, lw=1.6)
    r = 0.26
    ax.add_patch(plt.Circle((0, r / math.sin(th / 2) * math.cos(th / 2) * 0 + r), r,
                            fill=False, ec=AM, lw=1.4, ls="--"))
    cos_t = -np.dot(np.array([1, 0]), (p2 - p1) / np.linalg.norm(p2 - p1))
    sin_h = math.sqrt(0.5 * (1 - cos_t))
    v = math.sqrt(2000 * 0.05 * sin_h / (1 - sin_h)) if sin_h < 0.999 else 0
    ax.set_title(f"{lab}\nv qua góc ≈ {v:.0f} mm/s", fontsize=8.5)
    ax.set_xlim(-1.2, 1.2); ax.set_ylim(-0.35, 1.2); ax.set_aspect("equal"); ax.axis("off")
save(fig, "fig_junction.png")

# --- H11: sai lệch dây cung ------------------------------------------
fig, ax = plt.subplots(figsize=(4.6, 2.6))
r = 1.0; th = math.radians(70)
a0 = math.radians(55)
arc = np.linspace(a0, a0 + th, 100)
ax.plot(r * np.cos(arc), r * np.sin(arc), color=A_COL, lw=2, label="cung tròn thật")
ax.plot([r * math.cos(a0), r * math.cos(a0 + th)], [r * math.sin(a0), r * math.sin(a0 + th)],
        color=AM, lw=2, label="dây cung mà máy đi")
mid = a0 + th / 2
ax.plot([r * math.cos(mid), math.cos(mid) * r * math.cos(th / 2)],
        [r * math.sin(mid), math.sin(mid) * r * math.cos(th / 2)], color=B_COL, lw=1.4)
ax.annotate("sai lệch e", xy=(r * math.cos(mid) * 0.93, r * math.sin(mid) * 0.93),
            xytext=(0.15, 0.45), fontsize=8.5, color=B_COL,
            arrowprops=dict(arrowstyle="->", color=B_COL, lw=0.9))
ax.plot([0, r * math.cos(a0)], [0, r * math.sin(a0)], color=MUT, lw=0.8, ls=":")
ax.plot([0, r * math.cos(a0 + th)], [0, r * math.sin(a0 + th)], color=MUT, lw=0.8, ls=":")
ax.text(0.17, 0.09, "θ", fontsize=10, color=MUT)
ax.text(-0.42, 0.52, "r", fontsize=9, color=MUT)
ax.legend(frameon=False, fontsize=8, loc="lower left")
ax.set_xlim(-0.75, 0.95); ax.set_ylim(-0.05, 1.15); ax.set_aspect("equal"); ax.axis("off")
ax.set_title("e ≈ r·θ²/8   →   θ = √(8e/r)", fontsize=9)
save(fig, "fig_arc.png")

# --- H12: kiến trúc ---------------------------------------------------
fig, ax = plt.subplots(figsize=(5.6, 4.4))
boxes = [
    ("Lệnh G-code từ máy tính", "#EEF3F2", 9.0),
    ("gcode.c — đọc chữ, hiểu lệnh", "#E4EDEC", 7.6),
    ("motion_control.c — vị trí tuyệt đối,\nchia cung thành đoạn thẳng", "#E4EDEC", 6.1),
    ("stepper.c, phần planner — hàng đợi,\ntốc độ góc, lookahead", "#D7E7E6", 4.4),
    ("stepper.c, phần ISR — Bresenham,\nprofile tốc độ, phát xung", "#C9E0E0", 2.7),
    ("TMC2209 × 2 → động cơ", "#EEF3F2", 1.1),
]
for text, col, y in boxes:
    ax.add_patch(Rectangle((0.5, y - 0.45), 9, 0.9, fc=col, ec="#7FA3A3", lw=0.9))
    ax.text(5, y, text, ha="center", va="center", fontsize=8.6, linespacing=1.3)
for y in [8.4, 6.9, 5.3, 3.6, 2.0]:
    ax.annotate("", xy=(5, y - 0.28), xytext=(5, y + 0.28),
                arrowprops=dict(arrowstyle="-|>", color="#5A6862", lw=1.1))
ax.text(10.0, 5.3, "mm, số thực\nvòng lặp chính", fontsize=8, color=MUT, va="center")
ax.text(10.0, 2.7, "nhịp, số nguyên\ntrong ngắt", fontsize=8, color=A_COL, va="center", weight="bold")
ax.annotate("", xy=(9.7, 3.5), xytext=(9.7, 3.5))
ax.plot([0.3, 12.4], [3.55, 3.55], color=AM, lw=1.2, ls="--")
ax.text(0.3, 3.75, "ranh giới đổi đơn vị", fontsize=8, color="#8A6200")
ax.set_xlim(0, 13.2); ax.set_ylim(0.3, 9.8); ax.axis("off")
save(fig, "fig_arch.png")
print("xong")
