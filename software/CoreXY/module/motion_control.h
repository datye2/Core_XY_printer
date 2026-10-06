#ifndef MOTION_CONTROL_H
#define MOTION_CONTROL_H

#include <stdint.h>

/* Layer between the G-code parser and the stepper driver. It owns the
 * absolute position in mm and turns curves into straight segments — the
 * stepper layer only ever sees straight lines. */

void mc_init(void);

/* Straight line to an absolute position. Blocks only while the queue is
 * full, so the planner always has work to look ahead over. */
void mc_line(float x, float y, float feed_mm_s);

/* Arc to an absolute position around a centre given as an offset from the
 * current point (G2/G3 with I and J). clockwise = 1 for G2. */
void mc_arc(float x, float y, float i, float j, float feed_mm_s, uint8_t clockwise);

/* Declare the current point to be (x, y) without moving — G92. */
void mc_set_position(float x, float y);

float mc_x(void);
float mc_y(void);

#endif /* MOTION_CONTROL_H */
