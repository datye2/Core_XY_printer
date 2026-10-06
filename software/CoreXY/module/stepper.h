#ifndef STEPPER_H
#define STEPPER_H

#include <stdint.h>

typedef enum
{
  STEPPER_OK = 0,
  STEPPER_BUSY,      /* the queue is full, try again later */
  STEPPER_ERROR      /* speed out of range */
} stepper_status_t;

/* Pins to idle level, cycle counter, queue and position cleared.
 * TIM2 must be initialised (MX_TIM2_Init) before this is called. */
stepper_status_t stepper_init(void);

/* Queue a straight line in XY. CoreXY transform, Bresenham and the speed
 * profile happen inside. Returns as soon as the move is queued; the planner
 * looks ahead over everything in the queue so consecutive moves run into
 * each other without stopping. */
stepper_status_t stepper_move_xy(float dx_mm, float dy_mm, float speed_mm_s);

/* Acceleration for the moves that follow, mm/s^2. Default 2000. */
void stepper_set_accel(float accel_mm_s2);

/* How sharp a corner may be taken without slowing to a stop, in mm.
 * Larger = faster through corners but more rounding. Default 0.05. */
void stepper_set_junction_deviation(float jd_mm);

/* Non-zero while anything is queued or running. */
uint8_t stepper_busy(void);

/* Free slots in the queue. Zero means stepper_move_xy will refuse. */
uint8_t stepper_queue_free(void);

/* Block until the queue drains. Test helper — a real feeder never waits. */
void stepper_wait(void);

/* Stop now: drop the queue, halt the timer, leave the position as is.
 * Used by the '!' realtime command. */
void stepper_abort(void);

/* TIM2 interrupt entry point. Called from TIM2_IRQHandler. */
void stepper_tim2_isr(void);

/* Motor positions in steps (as executed), and the head position. */
int32_t stepper_pos_a(void);
int32_t stepper_pos_b(void);
float   stepper_pos_x(void);
float   stepper_pos_y(void);

#endif /* STEPPER_H */
