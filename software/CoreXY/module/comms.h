#ifndef COMMS_H
#define COMMS_H

#include <stdint.h>

/* Line protocol over USB CDC (or any byte stream).
 *
 *   host -> board : one G-code line per '\n'
 *   board -> host : "ok" when the line was accepted and queued,
 *                   "error:<n>" when the parser refused it.
 *
 * The host keeps several lines in flight and counts characters, the way
 * grbl does, so the planner always has something to look ahead over.
 * COMMS_RX_BUFFER is how many bytes may be outstanding.
 *
 * Single characters handled the moment they arrive, not queued:
 *   '?'  status report
 *   '!'  stop now: clear the queue and halt the motors
 *   '~'  resume after '!'
 *   0x18 soft reset (Ctrl-X)
 */

#define COMMS_RX_BUFFER   256

void comms_init(void);

/* Feed received bytes in. Safe to call from the USB interrupt. */
void comms_rx(const uint8_t *data, uint32_t len);

/* Pump from the main loop: assembles lines, runs them, answers. */
void comms_task(void);

/* Write a string back to the host. */
void comms_print(const char *s);

#endif /* COMMS_H */
