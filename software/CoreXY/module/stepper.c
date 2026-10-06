#include "stepper.h"
#include "main.h"
#include "tim.h"
#include "motion_control.h"
#include <math.h>

/* GT2 belt, 20 tooth pulley, 1/16 microstepping */
#define STEPS_PER_MM      80.0f

/* TIM2 runs at 1 MHz (prescaler 239 on a 240 MHz timer clock), so one tick
 * is one microsecond and ARR is the step period in us. */
#define TIM_TICK_HZ       1000000.0f
#define STEP_PULSE_US     2U       /* TMC2209 needs ~100 ns, 2 us is safe */
#define MIN_PERIOD_US     25U      /* 40 kHz per motor: what a NEMA17 follows */
#define START_PERIOD_US   2000U    /* slowest period used, ~6 mm/s */
#define DEFAULT_ACCEL     2000.0f  /* mm/s^2 */
#define DEFAULT_JD        0.05f    /* junction deviation, mm */

#define QUEUE_SIZE        32U      /* must be a power of two */
#define QUEUE_MASK        (QUEUE_SIZE - 1U)

#define A_STEP_PORT       STEP_A_PUL_GPIO_Port
#define A_STEP_PIN        STEP_A_PUL_Pin
#define B_STEP_PORT       STEP_B_PUL_GPIO_Port
#define B_STEP_PIN        STEP_B_PUL_Pin

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

typedef struct
{
  int32_t steps_a, steps_b;    /* magnitudes */
  int8_t  dir_a, dir_b;
  int32_t n;                   /* Bresenham events = steps of the busiest motor */

  float length_mm;
  float ux, uy;                /* unit vector of the move in XY */
  float accel;                 /* mm/s^2 */

  float nominal_speed;         /* mm/s, what was asked for */
  float max_entry_speed;       /* mm/s, limit set by the corner */
  float entry_speed;           /* mm/s, what the planner settled on */
} block_t;

static block_t queue[QUEUE_SIZE];
static volatile uint8_t q_head = 0;   /* where the planner writes */
static volatile uint8_t q_tail = 0;   /* what the ISR is running */

static uint8_t q_next(uint8_t i) { return (uint8_t)((i + 1U) & QUEUE_MASK); }

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

/* Planner side (main context only) */
static float pos_x_mm = 0.0f, pos_y_mm = 0.0f;   /* commanded head position */
static int32_t plan_a = 0, plan_b = 0;           /* commanded motor position, steps */
static float prev_ux = 0.0f, prev_uy = 0.0f;     /* direction of the last queued move */
static uint8_t have_prev = 0;
static float accel_mm_s2 = DEFAULT_ACCEL;
static float junction_dev = DEFAULT_JD;

/* Executor side (ISR) */
static volatile int32_t steps_a = 0, steps_b = 0;
static volatile int32_t err_a = 0, err_b = 0;
static volatile int32_t event_count = 0;
static volatile int32_t events_left = 0;
static volatile int8_t  dir_a = 1, dir_b = 1;
static volatile int32_t pos_a = 0, pos_b = 0;    /* executed position, steps */
static volatile uint8_t running = 0;
static volatile uint8_t stopping = 0;            /* last pulse still high */

/* Speed profile of the block being executed, in timer ticks */
static volatile uint32_t c = 0;          /* current period, us */
static volatile uint32_t c_min = 0;      /* period at cruise speed */
static volatile uint32_t rest = 0;       /* remainder of the integer divide */
/* Both thresholds are expressed in events_left, the one counter the
 * Bresenham loop already keeps, so there is no second index to keep in
 * step with it (grbl does the same). */
static volatile int32_t  cruise_from = 0;   /* ramp up   while events_left >  this */
static volatile int32_t  decel_from = 0;    /* ramp down while events_left <= this */
static volatile int32_t  i_offset = 0;      /* virtual ramp index at entry speed */
static volatile int32_t  j_offset = 0;      /* virtual ramp index at exit speed */

static void delay_us(uint32_t us)
{
  uint32_t start = DWT->CYCCNT;
  uint32_t ticks = us * (SystemCoreClock / 1000000U);
  while ((DWT->CYCCNT - start) < ticks)
  {
  }
}

/* ------------------------------------------------------------------ */
/* Planner                                                             */
/* ------------------------------------------------------------------ */

/* Speed reachable after accelerating over `distance` starting at v0. */
static float speed_after(float v0, float accel, float distance)
{
  return sqrtf(v0 * v0 + 2.0f * accel * distance);
}

/* Two passes over the queued blocks, grbl style. Backwards first: a block
 * may not enter faster than it can still brake down to the entry speed of
 * the one after it. Then forwards: it may not enter faster than the
 * previous block can accelerate it to. The block being executed is left
 * alone — its ramp is already running. */
static void recalculate(void)
{
  if (q_head == q_tail)
    return;

  uint8_t first = q_tail;
  if (running)
    first = q_next(q_tail);        /* do not touch what the ISR is running */
  if (first == q_head)
    return;

  /* backward pass */
  uint8_t i = q_head;
  float next_entry = 0.0f;         /* the queue ends at standstill */
  while (i != first)
  {
    i = (uint8_t)((i + QUEUE_MASK) & QUEUE_MASK);   /* i-- */
    block_t *b = &queue[i];
    float reachable = speed_after(next_entry, b->accel, b->length_mm);
    float v = b->max_entry_speed;
    if (reachable < v) v = reachable;
    if (b->nominal_speed < v) v = b->nominal_speed;
    b->entry_speed = v;
    next_entry = v;
    if (i == first)
      break;
  }

  /* forward pass */
  uint8_t prev = first;
  i = q_next(first);
  while (i != q_head)
  {
    block_t *p = &queue[prev];
    block_t *b = &queue[i];
    float reachable = speed_after(p->entry_speed, p->accel, p->length_mm);
    if (reachable < b->entry_speed)
      b->entry_speed = reachable;
    prev = i;
    i = q_next(i);
  }
}

/* Corner speed from the junction deviation model (grbl). A straight joint
 * keeps full speed, a hairpin drops to nearly zero. */
static float junction_speed(const block_t *b)
{
  if (!have_prev)
    return 0.0f;                    /* first move starts from standstill */

  float cos_theta = -(prev_ux * b->ux + prev_uy * b->uy);
  if (cos_theta > 0.999999f)
    return 0.0f;                    /* reversal: must stop */
  if (cos_theta < -0.999999f)
    return b->nominal_speed;        /* straight on */

  float sin_half = sqrtf(0.5f * (1.0f - cos_theta));
  if (sin_half >= 0.999999f)
    return 0.0f;
  return sqrtf(b->accel * junction_dev * sin_half / (1.0f - sin_half));
}

static void start_timer_if_idle(void)
{
  __disable_irq();
  if (!running && q_head != q_tail)
  {
    running = 1;
    stopping = 0;
    events_left = 0;              /* makes the first interrupt load a block */
    TIM2->ARR  = START_PERIOD_US - 1U;
    TIM2->CCR1 = STEP_PULSE_US;
    TIM2->EGR  = TIM_EGR_UG;      /* ARR is preloaded: load it now */
    TIM2->SR   = ~(TIM_SR_UIF | TIM_SR_CC1IF);
    TIM2->DIER |= TIM_DIER_UIE | TIM_DIER_CC1IE;
    TIM2->CR1  |= TIM_CR1_CEN;
  }
  __enable_irq();
}

stepper_status_t stepper_move_xy(float dx_mm, float dy_mm, float speed_mm_s)
{
  if (speed_mm_s <= 0.0f)
    return STEPPER_ERROR;

  uint8_t next = q_next(q_head);
  if (next == q_tail)
    return STEPPER_BUSY;            /* queue full */

  /* CoreXY: A = X + Y, B = X - Y, from the absolute target so rounding
   * never accumulates over many segments. */
  float tx = pos_x_mm + dx_mm;
  float ty = pos_y_mm + dy_mm;
  int32_t target_a = (int32_t)lroundf((tx + ty) * STEPS_PER_MM);
  int32_t target_b = (int32_t)lroundf((tx - ty) * STEPS_PER_MM);
  int32_t da = target_a - plan_a;
  int32_t db = target_b - plan_b;

  int32_t abs_a = (da >= 0) ? da : -da;
  int32_t abs_b = (db >= 0) ? db : -db;
  int32_t n = (abs_a > abs_b) ? abs_a : abs_b;
  if (n == 0)
  {
    pos_x_mm = tx;
    pos_y_mm = ty;
    return STEPPER_OK;              /* shorter than one step */
  }

  float length_mm = sqrtf(dx_mm * dx_mm + dy_mm * dy_mm);

  /* Speed cap: the busiest motor may not exceed MIN_PERIOD_US per step.
   * On a diagonal that motor runs sqrt(2) faster than the head, and n /
   * length already carries that factor. */
  float ticks_per_mm = (float)n / length_mm;
  float v_cap = (TIM_TICK_HZ / (float)MIN_PERIOD_US) / ticks_per_mm;
  if (speed_mm_s > v_cap)
    return STEPPER_ERROR;

  block_t *b = &queue[q_head];
  b->steps_a = abs_a;
  b->steps_b = abs_b;
  b->dir_a = (da >= 0) ? 1 : -1;
  b->dir_b = (db >= 0) ? 1 : -1;
  b->n = n;
  b->length_mm = length_mm;
  b->ux = dx_mm / length_mm;
  b->uy = dy_mm / length_mm;
  b->accel = accel_mm_s2;
  b->nominal_speed = speed_mm_s;

  float jv = junction_speed(b);
  if (jv > speed_mm_s)
    jv = speed_mm_s;
  b->max_entry_speed = jv;
  b->entry_speed = jv;

  plan_a = target_a;
  plan_b = target_b;
  pos_x_mm = tx;
  pos_y_mm = ty;
  prev_ux = b->ux;
  prev_uy = b->uy;
  have_prev = 1;

  q_head = next;
  recalculate();
  start_timer_if_idle();
  return STEPPER_OK;
}

void stepper_set_accel(float accel_mm_s2_new)
{
  if (accel_mm_s2_new > 0.0f)
    accel_mm_s2 = accel_mm_s2_new;
}

void stepper_set_junction_deviation(float jd_mm)
{
  if (jd_mm > 0.0f)
    junction_dev = jd_mm;
}

/* ------------------------------------------------------------------ */
/* Executor                                                            */
/* ------------------------------------------------------------------ */

static inline uint32_t period_of(float rate_ticks_s)
{
  if (rate_ticks_s < 1.0f)
    return START_PERIOD_US;
  uint32_t p = (uint32_t)(TIM_TICK_HZ / rate_ticks_s);
  if (p > START_PERIOD_US) p = START_PERIOD_US;
  if (p < MIN_PERIOD_US)   p = MIN_PERIOD_US;
  return p;
}

/* Turn the block at the tail into the integer ramp the ISR runs. Called
 * from the ISR, once per block, so the float maths here costs nothing per
 * step. The exit speed is the entry speed of the next queued block, or
 * zero when this is the last one. */
static uint8_t load_block(void)
{
  if (q_tail == q_head)
    return 0;

  block_t *b = &queue[q_tail];

  steps_a = b->steps_a;
  steps_b = b->steps_b;
  dir_a = b->dir_a;
  dir_b = b->dir_b;
  event_count = b->n;
  events_left = b->n;
  err_a = err_b = b->n / 2;
  rest = 0;

  A_STEP_PORT->BSRR = (uint32_t)A_STEP_PIN << 16U;
  B_STEP_PORT->BSRR = (uint32_t)B_STEP_PIN << 16U;
  HAL_GPIO_WritePin(STEP_A_Dir_GPIO_Port, STEP_A_Dir_Pin,
                    (dir_a > 0) ? GPIO_PIN_SET : GPIO_PIN_RESET);
  HAL_GPIO_WritePin(STEP_B_DIR_GPIO_Port, STEP_B_DIR_Pin,
                    (dir_b > 0) ? GPIO_PIN_SET : GPIO_PIN_RESET);

  uint8_t nxt = q_next(q_tail);
  float exit_speed = (nxt == q_head) ? 0.0f : queue[nxt].entry_speed;

  float tpm = (float)b->n / b->length_mm;
  float v_entry = b->entry_speed * tpm;        /* ticks/s */
  float v_nom   = b->nominal_speed * tpm;
  float v_exit  = exit_speed * tpm;
  float a       = b->accel * tpm;              /* ticks/s^2 */

  /* Ticks spent ramping, from v = sqrt(2 a s). */
  float up   = (v_nom * v_nom - v_entry * v_entry) / (2.0f * a);
  float down = (v_nom * v_nom - v_exit * v_exit) / (2.0f * a);
  if (up < 0.0f)   up = 0.0f;
  if (down < 0.0f) down = 0.0f;

  if (up + down > (float)b->n)
  {
    /* Triangle: cruise is never reached. Solve for where the ramps meet. */
    float peak = (2.0f * a * (float)b->n + v_exit * v_exit - v_entry * v_entry)
                 / (4.0f * a);
    if (peak < 0.0f) peak = 0.0f;
    if (peak > (float)b->n) peak = (float)b->n;
    up = peak;
    down = (float)b->n - peak;
  }

  cruise_from = b->n - (int32_t)up;    /* ramping up while more than this is left */
  decel_from  = (int32_t)down;

  /* Where the entry and exit speeds sit on an imaginary ramp that started
   * from standstill — this is what lets the recurrence continue smoothly
   * instead of restarting at zero on every block. */
  i_offset = (int32_t)((v_entry * v_entry) / (2.0f * a));
  j_offset = (int32_t)((v_exit * v_exit) / (2.0f * a));

  c     = period_of(v_entry);
  c_min = period_of(v_nom);
  if (c < c_min) c = c_min;

  TIM2->ARR = c - 1U;
  return 1;
}

static inline void timer_off(void)
{
  TIM2->CR1  &= ~TIM_CR1_CEN;
  TIM2->DIER &= ~(TIM_DIER_UIE | TIM_DIER_CC1IE);
  running = 0;
}

/* Two interrupts per step period:
 *   update (ARR)  -> Bresenham, raise the STEP pins, advance the profile
 *   compare (CC1) -> drop both STEP pins, STEP_PULSE_US later
 * Nothing waits: the timer measures the pulse width in hardware. */
void stepper_tim2_isr(void)
{
  uint32_t sr = TIM2->SR;

  if (sr & TIM_SR_CC1IF)
  {
    TIM2->SR = ~TIM_SR_CC1IF;
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
      /* block finished (or none loaded yet): take the next one */
      if (!load_block())
      {
        timer_off();
        return;
      }
      return;                       /* first pulse comes next period */
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
    {
      q_tail = q_next(q_tail);      /* release the block */
      if (!load_block())
        stopping = 1;               /* CC1 ends the last pulse, then stop */
      return;
    }

    /* Trapezoid, AVR446 recurrence. ARR is preloaded, so this takes effect
     * on the next period — exactly what a ramp wants. */
    if (events_left > cruise_from)
    {
      int32_t i = event_count - events_left;      /* ticks done so far */
      uint32_t num = 2U * c + rest;
      uint32_t den = 4U * (uint32_t)(i + i_offset) + 1U;
      uint32_t d = num / den;
      rest = num % den;
      c = (c > d + c_min) ? (c - d) : c_min;
    }
    else if (events_left <= decel_from)
    {
      uint32_t num = 2U * c + rest;
      uint32_t den = 4U * (uint32_t)(events_left + j_offset) + 1U;
      c += num / den;
      rest = num % den;
      if (c > START_PERIOD_US)
      {
        c = START_PERIOD_US;
        rest = 0;
      }
    }
    else
    {
      c = c_min;
      rest = 0;
    }

    TIM2->ARR = c - 1U;
  }
}

/* ------------------------------------------------------------------ */
/* Housekeeping                                                        */
/* ------------------------------------------------------------------ */

stepper_status_t stepper_init(void)
{
  CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
  DWT->CYCCNT = 0;
  DWT->CTRL |= DWT_CTRL_CYCCNTENA_Msk;
  (void)delay_us;

  HAL_GPIO_WritePin(STEP_A_PUL_GPIO_Port, STEP_A_PUL_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(STEP_A_Dir_GPIO_Port, STEP_A_Dir_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(STEP_B_PUL_GPIO_Port, STEP_B_PUL_Pin, GPIO_PIN_RESET);
  HAL_GPIO_WritePin(STEP_B_DIR_GPIO_Port, STEP_B_DIR_Pin, GPIO_PIN_RESET);

  q_head = q_tail = 0;
  running = 0;
  events_left = 0;
  pos_a = pos_b = 0;
  plan_a = plan_b = 0;
  pos_x_mm = pos_y_mm = 0.0f;
  have_prev = 0;
  return STEPPER_OK;
}

void stepper_abort(void)
{
  __disable_irq();
  TIM2->CR1  &= ~TIM_CR1_CEN;
  TIM2->DIER &= ~(TIM_DIER_UIE | TIM_DIER_CC1IE);
  running = 0;
  stopping = 0;
  events_left = 0;
  q_head = q_tail;                 /* drop everything still queued */
  __enable_irq();

  A_STEP_PORT->BSRR = (uint32_t)A_STEP_PIN << 16U;
  B_STEP_PORT->BSRR = (uint32_t)B_STEP_PIN << 16U;

  /* The planner must now follow the motors, not the other way round. */
  plan_a = pos_a;
  plan_b = pos_b;
  pos_x_mm = (float)(pos_a + pos_b) / (2.0f * STEPS_PER_MM);
  pos_y_mm = (float)(pos_a - pos_b) / (2.0f * STEPS_PER_MM);
  have_prev = 0;
  mc_set_position(pos_x_mm, pos_y_mm);
}

uint8_t stepper_busy(void)
{
  return (running || q_head != q_tail) ? 1U : 0U;
}

uint8_t stepper_queue_free(void)
{
  uint8_t used = (uint8_t)((q_head - q_tail) & QUEUE_MASK);
  return (uint8_t)(QUEUE_SIZE - 1U - used);
}

void stepper_wait(void)
{
  while (stepper_busy())
  {
  }
}

int32_t stepper_pos_a(void) { return pos_a; }
int32_t stepper_pos_b(void) { return pos_b; }
float stepper_pos_x(void) { return (float)(pos_a + pos_b) / (2.0f * STEPS_PER_MM); }
float stepper_pos_y(void) { return (float)(pos_a - pos_b) / (2.0f * STEPS_PER_MM); }
