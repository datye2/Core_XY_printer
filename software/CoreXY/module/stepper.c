#include "stepper.h"
#include "main.h"
#include "tim.h"
#include <math.h>

/* GT2 belt, 20 tooth pulley, 1/16 microstepping */
#define STEPS_PER_MM      80.0f

/* TIM2 runs at 1 MHz (prescaler 239 on a 240 MHz timer clock), so one tick
 * is one microsecond and ARR is the step period in us. */
#define TIM_TICK_HZ       1000000U
#define STEP_PULSE_US     2U       /* TMC2209 needs ~100 ns, 2 us is safe */
#define MIN_PERIOD_US     5U       /* 200 kHz ceiling per motor */

#define A_STEP_PORT       STEP_A_PUL_GPIO_Port
#define A_STEP_PIN        STEP_A_PUL_Pin
#define B_STEP_PORT       STEP_B_PUL_GPIO_Port
#define B_STEP_PIN        STEP_B_PUL_Pin

/* Shared with the interrupt */
static volatile int32_t steps_a = 0, steps_b = 0;    /* magnitudes */
static volatile int32_t err_a = 0, err_b = 0;        /* Bresenham accumulators */
static volatile int32_t event_count = 0;             /* ticks in this move */
static volatile int32_t events_left = 0;             /* ticks still to run */
static volatile int8_t  dir_a = 1, dir_b = 1;
static volatile int32_t pos_a = 0, pos_b = 0;        /* absolute, in steps */
static volatile uint8_t stopping = 0;                /* last pulse still high */

/* Commanded head position. Targets are computed from this in absolute terms
 * so rounding never accumulates over many segments. */
static float pos_x_mm = 0.0f, pos_y_mm = 0.0f;

static void delay_us(uint32_t us)
{
  uint32_t start = DWT->CYCCNT;
  uint32_t ticks = us * (SystemCoreClock / 1000000U);
  while ((DWT->CYCCNT - start) < ticks)
  {
  }
}

stepper_status_t stepper_init(void)
{
  /* cycle counter, used only for the step pulse width */
  CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
  DWT->CYCCNT = 0;
  DWT->CTRL |= DWT_CTRL_CYCCNTENA_Msk;

  HAL_GPIO_WritePin(STEP_A_PUL_GPIO_Port, STEP_A_PUL_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(STEP_A_Dir_GPIO_Port, STEP_A_Dir_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(STEP_B_PUL_GPIO_Port, STEP_B_PUL_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(STEP_B_DIR_GPIO_Port, STEP_B_DIR_Pin, GPIO_PIN_RESET);

  events_left = 0;
  pos_a = pos_b = 0;
  pos_x_mm = pos_y_mm = 0.0f;
  return STEPPER_OK;
}

stepper_status_t stepper_move_xy(float dx_mm, float dy_mm, float speed_mm_s)
{
  if (events_left != 0)
    return STEPPER_BUSY;
  if (speed_mm_s <= 0.0f)
    return STEPPER_ERROR;

  /* CoreXY: A = X + Y, B = X - Y, worked out from the absolute target */
  float tx = pos_x_mm + dx_mm;
  float ty = pos_y_mm + dy_mm;
  int32_t target_a = (int32_t)lroundf((tx + ty) * STEPS_PER_MM);
  int32_t target_b = (int32_t)lroundf((tx - ty) * STEPS_PER_MM);

  int32_t da = target_a - pos_a;
  int32_t db = target_b - pos_b;

  dir_a = (da >= 0) ? 1 : -1;
  dir_b = (db >= 0) ? 1 : -1;
  steps_a = (da >= 0) ? da : -da;
  steps_b = (db >= 0) ? db : -db;

  int32_t n = (steps_a > steps_b) ? steps_a : steps_b;
  if (n == 0)
  {
    pos_x_mm = tx;
    pos_y_mm = ty;
    return STEPPER_OK;
  }

  /* Tick rate follows the motor with the most steps, but the duration comes
   * from the distance the HEAD travels, in XY — not from A or B. */
  float length_mm = sqrtf(dx_mm * dx_mm + dy_mm * dy_mm);
  float duration_s = length_mm / speed_mm_s;
  uint32_t period_us = (uint32_t)((duration_s * 1000000.0f) / (float)n);
  if (period_us < MIN_PERIOD_US)
    return STEPPER_ERROR;          /* too fast for this pulse width */

  HAL_GPIO_WritePin(STEP_A_Dir_GPIO_Port, STEP_A_Dir_Pin,
                    (dir_a > 0) ? GPIO_PIN_SET : GPIO_PIN_RESET);
  HAL_GPIO_WritePin(STEP_B_DIR_GPIO_Port, STEP_B_DIR_Pin,
                    (dir_b > 0) ? GPIO_PIN_SET : GPIO_PIN_RESET);
  delay_us(10);                    /* DIR setup time before the first pulse */

  /* Half a tick of head start spreads the steps evenly (as grbl does) */
  event_count = n;
  err_a = err_b = n / 2;
  events_left = n;

  pos_x_mm = tx;
  pos_y_mm = ty;
  stopping = 0;

  /* Update event starts the pulse, compare match CC1 ends it STEP_PULSE_US
   * later — the hardware times the pulse, the ISR never waits. */
  TIM2->ARR  = period_us - 1U;
  TIM2->CCR1 = STEP_PULSE_US;
  /* ARR is preloaded (ARPE = 1), so force an update event to load it now —
   * otherwise the first period would still use the previous value. UG also
   * clears CNT; the UIF it raises is cleared right after. */
  TIM2->EGR  = TIM_EGR_UG;
  TIM2->SR   = ~(TIM_SR_UIF | TIM_SR_CC1IF);       /* no stale interrupt */
  TIM2->DIER |= TIM_DIER_UIE | TIM_DIER_CC1IE;
  TIM2->CR1  |= TIM_CR1_CEN;

  return STEPPER_OK;
}

uint8_t stepper_busy(void)
{
  return (events_left != 0) ? 1U : 0U;
}

void stepper_wait(void)
{
  while (events_left != 0)
  {
  }
}

int32_t stepper_pos_a(void) { return pos_a; }
int32_t stepper_pos_b(void) { return pos_b; }

/* Inverse transform: X = (A + B) / 2, Y = (A - B) / 2 */
float stepper_pos_x(void) { return (float)(pos_a + pos_b) / (2.0f * STEPS_PER_MM); }
float stepper_pos_y(void) { return (float)(pos_a - pos_b) / (2.0f * STEPS_PER_MM); }

static inline void timer_off(void)
{
  TIM2->CR1  &= ~TIM_CR1_CEN;
  TIM2->DIER &= ~(TIM_DIER_UIE | TIM_DIER_CC1IE);
}

/* Two interrupts per step period, both very short:
 *   update (ARR)  -> Bresenham, raise the STEP pins of the motors that step
 *   compare (CC1) -> drop both STEP pins, STEP_PULSE_US later
 * No waiting anywhere: the timer measures the pulse width in hardware. */
void stepper_tim2_isr(void)
{
  uint32_t sr = TIM2->SR;

  if (sr & TIM_SR_CC1IF)
  {
    TIM2->SR = ~TIM_SR_CC1IF;
    /* dropping a pin that is already low costs nothing, so no bookkeeping */
    A_STEP_PORT->BSRR = (uint32_t)A_STEP_PIN << 16U;
    B_STEP_PORT->BSRR = (uint32_t)B_STEP_PIN << 16U;

    if (stopping)
    {
      stopping = 0;
      timer_off();
      return;
    }
  }

  if (sr & TIM_SR_UIF)
  {
    TIM2->SR = ~TIM_SR_UIF;

    if (events_left == 0)
    {
      timer_off();
      return;
    }

    err_a += steps_a;
    err_b += steps_b;

    if (err_a >= event_count)
    {
      err_a -= event_count;
      A_STEP_PORT->BSRR = A_STEP_PIN;
      pos_a += dir_a;
    }
    if (err_b >= event_count)
    {
      err_b -= event_count;
      B_STEP_PORT->BSRR = B_STEP_PIN;
      pos_b += dir_b;
    }

    events_left--;
    if (events_left == 0)
      stopping = 1;     /* CC1 still has to end this last pulse */
  }
}
