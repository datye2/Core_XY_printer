#include "motion_test.h"
#include "main.h"

/* GT2 belt, 20 tooth pulley, 1/16 microstepping */
#define STEPS_PER_MM      80.0f

/* TMC2209 needs ~100 ns; 3 us is comfortable and still leaves room at the
 * speeds this test uses. */
#define STEP_PULSE_US     3U

#define A_STEP_PORT       STEP_A_PUL_GPIO_Port
#define A_STEP_PIN        STEP_A_PUL_Pin
#define A_DIR_PORT        STEP_A_Dir_GPIO_Port
#define A_DIR_PIN         STEP_A_Dir_Pin
#define B_STEP_PORT       STEP_B_PUL_GPIO_Port
#define B_STEP_PIN        STEP_B_PUL_Pin
#define B_DIR_PORT        STEP_B_DIR_GPIO_Port
#define B_DIR_PIN         STEP_B_DIR_Pin

void motion_test_init(void)
{
  CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
  DWT->CYCCNT = 0;
  DWT->CTRL |= DWT_CTRL_CYCCNTENA_Msk;
}

static void delay_us(uint32_t us)
{
  uint32_t start = DWT->CYCCNT;
  uint32_t ticks = us * (SystemCoreClock / 1000000U);
  while ((DWT->CYCCNT - start) < ticks)
  {
  }
}

void motion_move_xy(float dx_mm, float dy_mm, float speed_mm_s)
{
  /* CoreXY kinematics */
  float da_mm = dx_mm + dy_mm;
  float db_mm = dx_mm - dy_mm;

  int32_t da = (int32_t)(da_mm * STEPS_PER_MM);
  int32_t db = (int32_t)(db_mm * STEPS_PER_MM);

  HAL_GPIO_WritePin(A_DIR_PORT, A_DIR_PIN, (da >= 0) ? GPIO_PIN_SET : GPIO_PIN_RESET);
  HAL_GPIO_WritePin(B_DIR_PORT, B_DIR_PIN, (db >= 0) ? GPIO_PIN_SET : GPIO_PIN_RESET);
  delay_us(10);   /* DIR setup time before the first pulse */

  uint32_t steps_a = (uint32_t)((da < 0) ? -da : da);
  uint32_t steps_b = (uint32_t)((db < 0) ? -db : db);
  uint32_t n = (steps_a > steps_b) ? steps_a : steps_b;
  if (n == 0U)
    return;

  /* Step rate of the motor that moves the most. The head travels
   * hypot(dx, dy) mm in the same time. */
  float len_mm = dx_mm * dx_mm + dy_mm * dy_mm;
  len_mm = (len_mm > 0.0f) ? __builtin_sqrtf(len_mm) : 0.0f;
  float duration_s = (speed_mm_s > 0.0f) ? (len_mm / speed_mm_s) : 1.0f;
  uint32_t period_us = (uint32_t)((duration_s * 1000000.0f) / (float)n);
  if (period_us <= STEP_PULSE_US)
    period_us = STEP_PULSE_US + 1U;

  /* Bresenham: both motors share one tick, each steps when its error term
   * rolls over. */
  int32_t err_a = 0, err_b = 0;
  for (uint32_t i = 0; i < n; i++)
  {
    err_a += (int32_t)steps_a;
    err_b += (int32_t)steps_b;
    uint8_t pulse_a = (err_a >= (int32_t)n);
    uint8_t pulse_b = (err_b >= (int32_t)n);

    if (pulse_a)
    {
      err_a -= (int32_t)n;
      HAL_GPIO_WritePin(A_STEP_PORT, A_STEP_PIN, GPIO_PIN_SET);
    }
    if (pulse_b)
    {
      err_b -= (int32_t)n;
      HAL_GPIO_WritePin(B_STEP_PORT, B_STEP_PIN, GPIO_PIN_SET);
    }
    delay_us(STEP_PULSE_US);
    if (pulse_a)
      HAL_GPIO_WritePin(A_STEP_PORT, A_STEP_PIN, GPIO_PIN_RESET);
    if (pulse_b)
      HAL_GPIO_WritePin(B_STEP_PORT, B_STEP_PIN, GPIO_PIN_RESET);

    delay_us(period_us - STEP_PULSE_US);
  }
}

void motion_test_demo(float size_mm, float speed_mm_s)
{
  motion_move_xy( size_mm,      0.0f, speed_mm_s);   /* +X: both motors, same direction */
  HAL_Delay(300);
  motion_move_xy(    0.0f,   size_mm, speed_mm_s);   /* +Y: both motors, opposite directions */
  HAL_Delay(300);
  motion_move_xy(-size_mm,      0.0f, speed_mm_s);
  HAL_Delay(300);
  motion_move_xy(    0.0f,  -size_mm, speed_mm_s);
  HAL_Delay(300);

  /* Diagonals: only one motor turns for each */
  motion_move_xy( size_mm / 2,  size_mm / 2, speed_mm_s);   /* motor A only */
  HAL_Delay(300);
  motion_move_xy(-size_mm / 2, -size_mm / 2, speed_mm_s);
  HAL_Delay(300);
  motion_move_xy( size_mm / 2, -size_mm / 2, speed_mm_s);   /* motor B only */
  HAL_Delay(300);
  motion_move_xy(-size_mm / 2,  size_mm / 2, speed_mm_s);
}
