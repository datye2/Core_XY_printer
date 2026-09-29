#ifndef TMC2209_H
#define TMC2209_H

#include <stdint.h>

/* UART node addresses (set by MS1/MS2 pins) */
#define TMC2209_ADDR_A          0U
#define TMC2209_ADDR_B          1U

/* Registers */
#define TMC2209_REG_GCONF       0x00U
#define TMC2209_REG_GSTAT       0x01U
#define TMC2209_REG_IFCNT       0x02U
#define TMC2209_REG_NODECONF    0x03U
#define TMC2209_REG_IOIN        0x06U
#define TMC2209_REG_CHOPCONF    0x6CU

#define TMC2209_VERSION         0x21U   /* IOIN[31:24] */

typedef enum
{
  TMC2209_OK = 0,
  TMC2209_TIMEOUT,        /* no echo or no reply: wiring, VM power, address */
  TMC2209_UART_ERROR,     /* HAL error: overrun, framing, noise */
  TMC2209_ECHO_ERROR,     /* echo differs from what was sent */
  TMC2209_CRC_ERROR,      /* reply CRC mismatch */
  TMC2209_REPLY_ERROR,    /* reply header/register byte wrong */
  TMC2209_WRONG_CHIP,     /* IOIN version is not 0x21 */
  TMC2209_VERIFY_ERROR,   /* write not confirmed by IFCNT / read-back */
  TMC2209_PARAM_ERROR     /* bad address or microstep value */
} tmc2209_status_t;

tmc2209_status_t tmc2209_read_reg(uint8_t addr, uint8_t reg, uint32_t *value);
tmc2209_status_t tmc2209_write_reg(uint8_t addr, uint8_t reg, uint32_t value);

/* Configure one driver: UART control, microstepping from register
 * (microsteps = 1, 2, 4, ... 256), interpolation on, current from VREF. */
tmc2209_status_t tmc2209_init(uint8_t addr, uint16_t microsteps);

#endif /* TMC2209_H */
