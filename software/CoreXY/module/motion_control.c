#include "motion_control.h"
#include "stepper.h"
#include <math.h>

/* Chord tolerance for arcs: the gap between the chord and the real arc.
 * grbl uses 0.002 mm; one microstep on this machine is 0.0125 mm. */
#define ARC_TOLERANCE_MM   0.002f
#define ARC_MIN_SEGMENTS   8
#define ARC_MAX_SEGMENTS   2000

static float cur_x = 0.0f, cur_y = 0.0f;

void mc_init(void)
{
  cur_x = 0.0f;
  cur_y = 0.0f;
}

void mc_set_position(float x, float y)
{
  cur_x = x;
  cur_y = y;
}

float mc_x(void) { return cur_x; }
float mc_y(void) { return cur_y; }

void mc_line(float x, float y, float feed_mm_s)
{
  while (stepper_queue_free() == 0)
  {
    /* keep the queue full so the planner can look ahead */
  }

  if (stepper_move_xy(x - cur_x, y - cur_y, feed_mm_s) == STEPPER_OK)
  {
    cur_x = x;
    cur_y = y;
  }
}

/* Split the arc into chords short enough that the sag stays under
 * ARC_TOLERANCE_MM, then hand them to mc_line. Same idea as mc_arc() in
 * grbl: the stepper layer never knows an arc existed. */
void mc_arc(float x, float y, float i, float j, float feed_mm_s, uint8_t clockwise)
{
  float cx = cur_x + i;
  float cy = cur_y + j;
  float r = sqrtf(i * i + j * j);
  if (r < 1e-4f)
  {
    mc_line(x, y, feed_mm_s);
    return;
  }

  float a_start = atan2f(cur_y - cy, cur_x - cx);
  float a_end   = atan2f(y - cy, x - cx);
  float sweep   = a_end - a_start;

  if (clockwise)
  {
    while (sweep >= 0.0f)        sweep -= 2.0f * (float)M_PI;
    while (sweep < -2.0f * (float)M_PI) sweep += 2.0f * (float)M_PI;
  }
  else
  {
    while (sweep <= 0.0f)        sweep += 2.0f * (float)M_PI;
    while (sweep > 2.0f * (float)M_PI)  sweep -= 2.0f * (float)M_PI;
  }

  /* Full circle: start and end coincide, so the sweep collapses to zero. */
  if (fabsf(sweep) < 1e-6f)
    sweep = clockwise ? -2.0f * (float)M_PI : 2.0f * (float)M_PI;

  /* sag = r(1 - cos(theta/2)) ~ r*theta^2/8  ->  theta = sqrt(8*tol/r) */
  float theta = sqrtf(8.0f * ARC_TOLERANCE_MM / r);
  int32_t segments = (int32_t)(fabsf(sweep) / theta) + 1;
  if (segments < ARC_MIN_SEGMENTS) segments = ARC_MIN_SEGMENTS;
  if (segments > ARC_MAX_SEGMENTS) segments = ARC_MAX_SEGMENTS;

  for (int32_t s = 1; s <= segments; s++)
  {
    float a = a_start + sweep * (float)s / (float)segments;
    mc_line(cx + r * cosf(a), cy + r * sinf(a), feed_mm_s);
  }

  /* land exactly on the commanded end point */
  mc_line(x, y, feed_mm_s);
}
