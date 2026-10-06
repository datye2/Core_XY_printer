#!/usr/bin/env python3
"""Generate a small XY-only G-code file to exercise the parser and planner.

    ./tools/make_gcode.py > demo.gcode

Everything stays inside a 80 x 80 mm box centred on wherever the machine
happens to be when the job starts, so it is safe to run without homing.
"""
import math

F = 6000          # mm/min = 100 mm/s
R = 30.0          # mm, size of the shapes

out = []
w = out.append

w("; CoreXY demo job - XY only, no Z, no extruder")
w("; stays within +/- 40 mm of the start point")
w("G21")                      # mm
w("G90")                      # absolute
w("G92 X0 Y0")                # here is the origin
w(f"F{F}")

w("; --- square ---")
for x, y in [(R, 0), (R, R), (0, R), (0, 0)]:
    w(f"G1 X{x:.3f} Y{y:.3f}")

w("; --- five pointed star, sharp corners to exercise the junction logic ---")
pts = []
for k in range(6):
    a = math.radians(-90 + k * 144)
    pts.append((R * 0.6 * math.cos(a), R * 0.6 * math.sin(a) + R * 0.6))
w(f"G0 X{pts[0][0]:.3f} Y{pts[0][1]:.3f}")
for x, y in pts[1:]:
    w(f"G1 X{x:.3f} Y{y:.3f}")

w("; --- circle as a single G2, the firmware splits it into chords ---")
w(f"G0 X{R:.3f} Y0")
w(f"G2 X{R:.3f} Y0 I{-R/2:.3f} J0")

w("; --- rounded rectangle: lines joined by quarter arcs ---")
r = 6.0
x0, y0, x1, y1 = -R, -R, 0.0, -R + 20.0
w(f"G0 X{x0 + r:.3f} Y{y0:.3f}")
w(f"G1 X{x1 - r:.3f} Y{y0:.3f}")
w(f"G3 X{x1:.3f} Y{y0 + r:.3f} I0 J{r:.3f}")
w(f"G1 X{x1:.3f} Y{y1 - r:.3f}")
w(f"G3 X{x1 - r:.3f} Y{y1:.3f} I{-r:.3f} J0")
w(f"G1 X{x0 + r:.3f} Y{y1:.3f}")
w(f"G3 X{x0:.3f} Y{y1 - r:.3f} I0 J{-r:.3f}")
w(f"G1 X{x0:.3f} Y{y0 + r:.3f}")
w(f"G3 X{x0 + r:.3f} Y{y0:.3f} I{r:.3f} J0")

w("; --- zigzag: many short segments, the lookahead test ---")
w("G0 X-30 Y30")
for k in range(20):
    w(f"G1 X{-30 + (k + 1) * 3:.3f} Y{30 + (3 if k % 2 == 0 else -3):.3f}")

w("; --- back home ---")
w("G0 X0 Y0")
w("M2")                       # end of program, ignored by the parser

print("\n".join(out))
