#ifndef STEPPER_H
#define STEPPER_H

#include <stdint.h>

typedef enum
{
  STEPPER_OK = 0,
  STEPPER_BUSY,      /* a move is still running */
  STEPPER_ERROR      /* speed out of range */
} stepper_status_t;

/* Pins to idle level, cycle counter for the pulse width, position to zero.
 * TIM2 must be initialised (MX_TIM2_Init) before this is called. */
stepper_status_t stepper_init(void);

/* Straight line in XY. CoreXY transform and Bresenham are inside, both
 * motors run off TIM2. Returns immediately; the interrupt does the work.
 * Constant speed, no acceleration yet, so keep speed_mm_s modest. */
stepper_status_t stepper_move_xy(float dx_mm, float dy_mm, float speed_mm_s);

/* Non-zero while a move is running. */
uint8_t stepper_busy(void);

/* Block until the current move ends. Test helper — a planner never waits. */
void stepper_wait(void);

/* TIM2 interrupt entry point. Called from TIM2_IRQHandler in
 * stm32h7xx_it.c, before the HAL handler. */
void stepper_tim2_isr(void);

/* Motor positions in steps, and the head position they work out to. */
int32_t stepper_pos_a(void);
int32_t stepper_pos_b(void);
float   stepper_pos_x(void);
float   stepper_pos_y(void);

#endif /* STEPPER_H */
