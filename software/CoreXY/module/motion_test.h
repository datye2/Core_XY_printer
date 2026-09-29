#ifndef MOTION_TEST_H
#define MOTION_TEST_H

#include <stdint.h>

/* Bring up the cycle counter used for step timing. Call once after the clock
 * is configured. */
void motion_test_init(void);

/* Straight line in XY, CoreXY transform inside: dA = dx + dy, dB = dx - dy.
 * Constant speed, no acceleration, so keep it slow. */
void motion_move_xy(float dx_mm, float dy_mm, float speed_mm_s);

/* Small demo: a square drawn as +X, +Y, -X, -Y, then the two diagonals. */
void motion_test_demo(float size_mm, float speed_mm_s);

#endif /* MOTION_TEST_H */
