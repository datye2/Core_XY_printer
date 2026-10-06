#include "gcode.h"
#include "motion_control.h"
#include "main.h"
#include <stdlib.h>
#include <math.h>

/* G-code gives feed in mm/min, the motion layer works in mm/s. */
#define MM_MIN_TO_MM_S(f)   ((f) / 60.0f)

#define RAPID_FEED_MM_S     120.0f    /* G0 when no F has been given */

static uint8_t absolute_mode = 1;
static int8_t  motion_mode = 0;       /* 0, 1, 2 or 3 */
static float   feed_mm_s = 0.0f;

void gcode_init(void)
{
  absolute_mode = 1;
  motion_mode = 0;
  feed_mm_s = 0.0f;
  mc_init();
}

float gcode_feed(void) { return feed_mm_s; }

static const char *skip_space(const char *p)
{
  while (*p == ' ' || *p == '\t' || *p == '\r')
    p++;
  return p;
}

gcode_status_t gcode_line(const char *line)
{
  const char *p = line;

  /* words seen on this line */
  uint8_t has_x = 0, has_y = 0, has_i = 0, has_j = 0;
  float wx = 0.0f, wy = 0.0f, wi = 0.0f, wj = 0.0f, dwell = 0.0f;
  int8_t new_motion = -1;
  uint8_t has_dwell = 0, saw_word = 0;

  while (*p)
  {
    p = skip_space(p);
    if (*p == '\0' || *p == '\n' || *p == ';' || *p == '%')
      break;

    if (*p == '(')                      /* inline comment */
    {
      while (*p && *p != ')')
        p++;
      if (*p == ')')
        p++;
      continue;
    }

    char letter = *p++;
    if (letter >= 'a' && letter <= 'z')
      letter = (char)(letter - 'a' + 'A');

    char *end;
    float value = strtof(p, &end);
    if (end == p)
      return GCODE_BAD_FORMAT;
    p = end;
    saw_word = 1;

    switch (letter)
    {
      case 'G':
      {
        int code = (int)lroundf(value);
        switch (code)
        {
          case 0: case 1: case 2: case 3: new_motion = (int8_t)code; break;
          case 4:  has_dwell = 1; break;
          case 90: absolute_mode = 1; break;
          case 91: absolute_mode = 0; break;
          case 92: new_motion = -2; break;     /* set position */
          case 21: break;                      /* mm, the only unit here */
          case 20: return GCODE_UNSUPPORTED;   /* inches */
          default: return GCODE_UNSUPPORTED;
        }
        break;
      }

      case 'X': wx = value; has_x = 1; break;
      case 'Y': wy = value; has_y = 1; break;
      case 'I': wi = value; has_i = 1; break;
      case 'J': wj = value; has_j = 1; break;
      case 'F': feed_mm_s = MM_MIN_TO_MM_S(value); break;
      case 'P': case 'S': dwell = value; break;

      /* Accepted and ignored so slicer output still runs on an XY rig */
      case 'Z': case 'E': case 'M': case 'T': case 'N': break;

      default: return GCODE_UNSUPPORTED;
    }
  }

  if (!saw_word)
    return GCODE_EMPTY;

  /* G92: move nothing, just relabel the current point */
  if (new_motion == -2)
  {
    mc_set_position(has_x ? wx : mc_x(), has_y ? wy : mc_y());
    return GCODE_OK;
  }

  if (has_dwell)
  {
    uint32_t ms = (uint32_t)(dwell * ((dwell < 100.0f) ? 1000.0f : 1.0f));
    HAL_Delay(ms);
    return GCODE_OK;
  }

  if (new_motion >= 0)
    motion_mode = new_motion;

  if (!has_x && !has_y)
    return GCODE_OK;                    /* a line with only F, Z or E */

  /* Where to go, in absolute mm */
  float tx = has_x ? (absolute_mode ? wx : mc_x() + wx) : mc_x();
  float ty = has_y ? (absolute_mode ? wy : mc_y() + wy) : mc_y();

  float feed = feed_mm_s;
  if (motion_mode == 0)
    feed = (feed_mm_s > 0.0f) ? feed_mm_s : RAPID_FEED_MM_S;
  if (feed <= 0.0f)
    return GCODE_NO_FEED;

  if (motion_mode == 2 || motion_mode == 3)
  {
    if (!has_i && !has_j)
      return GCODE_BAD_FORMAT;          /* R form not implemented */
    mc_arc(tx, ty, has_i ? wi : 0.0f, has_j ? wj : 0.0f,
           feed, (motion_mode == 2) ? 1U : 0U);
  }
  else
  {
    mc_line(tx, ty, feed);
  }

  return GCODE_OK;
}
