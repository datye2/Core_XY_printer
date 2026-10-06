; CoreXY demo job - XY only, no Z, no extruder
; stays within +/- 40 mm of the start point
G21
G90
G92 X0 Y0
F6000
; --- square ---
G1 X30.000 Y0.000
G1 X30.000 Y30.000
G1 X0.000 Y30.000
G1 X0.000 Y0.000
; --- five pointed star, sharp corners to exercise the junction logic ---
G0 X0.000 Y0.000
G1 X10.580 Y32.562
G1 X-17.119 Y12.438
G1 X17.119 Y12.438
G1 X-10.580 Y32.562
G1 X-0.000 Y0.000
; --- circle as a single G2, the firmware splits it into chords ---
G0 X30.000 Y0
G2 X30.000 Y0 I-15.000 J0
; --- rounded rectangle: lines joined by quarter arcs ---
G0 X-24.000 Y-30.000
G1 X-6.000 Y-30.000
G3 X0.000 Y-24.000 I0 J6.000
G1 X0.000 Y-16.000
G3 X-6.000 Y-10.000 I-6.000 J0
G1 X-24.000 Y-10.000
G3 X-30.000 Y-16.000 I0 J-6.000
G1 X-30.000 Y-24.000
G3 X-24.000 Y-30.000 I6.000 J0
; --- zigzag: many short segments, the lookahead test ---
G0 X-30 Y30
G1 X-27.000 Y33.000
G1 X-24.000 Y27.000
G1 X-21.000 Y33.000
G1 X-18.000 Y27.000
G1 X-15.000 Y33.000
G1 X-12.000 Y27.000
G1 X-9.000 Y33.000
G1 X-6.000 Y27.000
G1 X-3.000 Y33.000
G1 X0.000 Y27.000
G1 X3.000 Y33.000
G1 X6.000 Y27.000
G1 X9.000 Y33.000
G1 X12.000 Y27.000
G1 X15.000 Y33.000
G1 X18.000 Y27.000
G1 X21.000 Y33.000
G1 X24.000 Y27.000
G1 X27.000 Y33.000
G1 X30.000 Y27.000
; --- back home ---
G0 X0 Y0
M2
