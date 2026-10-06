#ifndef GCODE_H
#define GCODE_H

#include <stdint.h>

typedef enum
{
  GCODE_OK = 0,
  GCODE_EMPTY,          /* comment or blank line */
  GCODE_UNSUPPORTED,    /* a word this parser does not implement */
  GCODE_BAD_FORMAT,     /* a letter with no number after it */
  GCODE_NO_FEED         /* G1 before any F was given */
} gcode_status_t;

/* Modal state back to defaults: absolute, no feed, position zero. */
void gcode_init(void);

/* Run one line. Supported: G0, G1, G2, G3, G4, G90, G91, G92, F, X, Y,
 * I, J, plus ';' and '(...)' comments. Z, E, M and S are accepted and
 * ignored so a real printer file still runs on an XY-only machine. */
gcode_status_t gcode_line(const char *line);

/* Feed rate currently in force, mm/s. */
float gcode_feed(void);

#endif /* GCODE_H */
