#include "tmc2209.h"
#include "usart.h"
#include <string.h>

/* Bus: USART3, PB10 TX via 1k + PB11 RX on the same PDN_UART line,
 * so every transmitted byte is echoed back on RX. */
#define TMC_UART            (&huart3)
#define TMC_MAX_FRAME       8U
#define TMC_SYNC            0x05U
#define TMC_MASTER_ADDR     0xFFU
#define TMC_WRITE_BIT       0x80U
#define TMC_TIMEOUT_MARGIN_MS  5U   /* reply delay (SENDDELAY) + tick rounding */

/* GCONF bits */
#define GCONF_I_SCALE_ANALOG    (1UL << 0)
#define GCONF_PDN_DISABLE       (1UL << 6)
#define GCONF_MSTEP_REG_SELECT  (1UL << 7)
#define GCONF_MULTISTEP_FILT    (1UL << 8)

/* CHOPCONF fields */
#define CHOPCONF_MRES_POS       24U
#define CHOPCONF_MRES_MASK      (0xFUL << CHOPCONF_MRES_POS)
#define CHOPCONF_INTPOL         (1UL << 28)

/* NODECONF: SENDDELAY >= 2 required with several nodes on one bus */
#define NODECONF_SENDDELAY_2    (2UL << 8)

/* CRC8 from the TMC2209 datasheet (poly x^8 + x^2 + x + 1, LSB first).
 * Computes over len-1 bytes and stores the result in the last byte. */
static void calc_crc(uint8_t *datagram, uint8_t len)
{
  uint8_t *crc = datagram + (len - 1);
  *crc = 0;
  for (uint8_t i = 0; i < (len - 1); i++)
  {
    uint8_t current = datagram[i];
    for (uint8_t j = 0; j < 8; j++)
    {
      if ((*crc >> 7) ^ (current & 0x01))
        *crc = (uint8_t)((*crc << 1) ^ 0x07);
      else
        *crc = (uint8_t)(*crc << 1);
      current >>= 1;
    }
  }
}

/* Last bus transaction, for the debugger:
 * rx_count == 0          -> no echo at all: TX/RX wiring or pin config
 * rx_count == tx_len     -> echo OK, driver silent: VM, VIO, address, CRC
 * 0 < rx_count < tx_len  -> line disturbed / partial echo */
volatile struct
{
  uint8_t tx[TMC_MAX_FRAME];
  uint8_t tx_len;
  uint8_t rx[TMC_MAX_FRAME * 2];
  uint8_t rx_expected;
  uint8_t rx_count;
  uint8_t stage;              /* 1 = transmit failed, 2 = receive failed, 0 = ok */
} tmc2209_dbg;

/* One byte is 10 bit times (start + 8 data + stop), so the timeout has to
 * follow the configured baud rate: 8 bytes take 8.3 ms at 9600 baud but
 * only 0.7 ms at 115200. */
static uint32_t frame_timeout_ms(uint8_t bytes)
{
  uint32_t baud = TMC_UART->Init.BaudRate;
  if (baud == 0U)
    baud = 9600U;
  return ((uint32_t)bytes * 10U * 1000U) / baud + TMC_TIMEOUT_MARGIN_MS;
}

/* The datasheet says the driver keeps driving the line for four bit times
 * after its last bit. Starting the next datagram inside that window makes
 * both sides drive the bus and the bytes come back shifted, so leave a gap
 * of roughly ten bit times between transactions. */
static void bus_gap(void)
{
  uint32_t baud = TMC_UART->Init.BaudRate;
  if (baud == 0U)
    baud = 9600U;
  HAL_Delay(10U * 1000U / baud + 1U);
}

static tmc2209_status_t from_hal(HAL_StatusTypeDef hs)
{
  if (hs == HAL_OK)
    return TMC2209_OK;
  return (hs == HAL_TIMEOUT) ? TMC2209_TIMEOUT : TMC2209_UART_ERROR;
}

/* Send tx_len bytes, then receive echo (tx_len bytes) + reply (rx_len bytes).
 * The echo arrives while transmitting; the 16-byte RX FIFO (Fifo Mode
 * enabled in CubeMX) holds it until HAL_UART_Receive reads it. */
static tmc2209_status_t transfer(const uint8_t *tx, uint8_t tx_len, uint8_t *rx, uint8_t rx_len)
{
  uint8_t buf[TMC_MAX_FRAME * 2] = { 0 };
  uint8_t total = tx_len + rx_len;
  tmc2209_status_t st;

  /* drop stale bytes and error flags from earlier traffic */
  __HAL_UART_SEND_REQ(TMC_UART, UART_RXDATA_FLUSH_REQUEST);
  __HAL_UART_CLEAR_FLAG(TMC_UART, UART_CLEAR_OREF | UART_CLEAR_FEF | UART_CLEAR_NEF | UART_CLEAR_PEF);

  for (uint8_t i = 0; i < tx_len; i++)
    tmc2209_dbg.tx[i] = tx[i];
  tmc2209_dbg.tx_len = tx_len;
  tmc2209_dbg.rx_expected = total;
  tmc2209_dbg.rx_count = 0;

  st = from_hal(HAL_UART_Transmit(TMC_UART, tx, tx_len, frame_timeout_ms(tx_len)));
  if (st != TMC2209_OK)
  {
    tmc2209_dbg.stage = 1;
    return st;
  }

  st = from_hal(HAL_UART_Receive(TMC_UART, buf, total, frame_timeout_ms(total)));
  tmc2209_dbg.rx_count = (uint8_t)(total - TMC_UART->RxXferCount);
  for (uint8_t i = 0; i < total; i++)
    tmc2209_dbg.rx[i] = buf[i];
  bus_gap();
  if (st != TMC2209_OK)
  {
    tmc2209_dbg.stage = 2;
    return st;
  }
  tmc2209_dbg.stage = 0;

  if (memcmp(buf, tx, tx_len) != 0)
    return TMC2209_ECHO_ERROR;
  if (rx_len > 0)
    memcpy(rx, buf + tx_len, rx_len);
  return TMC2209_OK;
}

tmc2209_status_t tmc2209_read_reg(uint8_t addr, uint8_t reg, uint32_t *value)
{
  uint8_t req[4] = { TMC_SYNC, addr, (uint8_t)(reg & 0x7FU), 0 };
  uint8_t rep[8];
  uint8_t crc;
  tmc2209_status_t st;

  if (addr > 3U)
    return TMC2209_PARAM_ERROR;

  calc_crc(req, sizeof(req));
  st = transfer(req, sizeof(req), rep, sizeof(rep));
  if (st != TMC2209_OK)
    return st;

  crc = rep[7];
  calc_crc(rep, sizeof(rep));   /* overwrites rep[7] with the expected CRC */
  if (crc != rep[7])
    return TMC2209_CRC_ERROR;
  if (rep[0] != TMC_SYNC || rep[1] != TMC_MASTER_ADDR || rep[2] != (reg & 0x7FU))
    return TMC2209_REPLY_ERROR;

  *value = ((uint32_t)rep[3] << 24) | ((uint32_t)rep[4] << 16) |
           ((uint32_t)rep[5] << 8)  |  (uint32_t)rep[6];
  return TMC2209_OK;
}

tmc2209_status_t tmc2209_write_reg(uint8_t addr, uint8_t reg, uint32_t value)
{
  uint8_t req[8] = {
    TMC_SYNC, addr, (uint8_t)(reg | TMC_WRITE_BIT),
    (uint8_t)(value >> 24), (uint8_t)(value >> 16), (uint8_t)(value >> 8), (uint8_t)value,
    0
  };

  if (addr > 3U)
    return TMC2209_PARAM_ERROR;

  calc_crc(req, sizeof(req));
  return transfer(req, sizeof(req), NULL, 0);   /* writes get no reply */
}

static int mres_from_microsteps(uint16_t microsteps)
{
  /* 256 -> 0, 128 -> 1, ... 2 -> 7, 1 (full step) -> 8 */
  for (int mres = 0; mres <= 8; mres++)
  {
    if (microsteps == (256U >> mres))
      return mres;
  }
  return -1;
}

tmc2209_status_t tmc2209_init(uint8_t addr, uint16_t microsteps)
{
  int mres = mres_from_microsteps(microsteps);
  uint32_t ifcnt0, ifcnt1, ioin, chopconf;
  tmc2209_status_t st;

  if (addr > 3U || mres < 0)
    return TMC2209_PARAM_ERROR;

  /* NODECONF is write-only; set it first so replies wait long enough */
  if ((st = tmc2209_write_reg(addr, TMC2209_REG_NODECONF, NODECONF_SENDDELAY_2)) != TMC2209_OK)
    return st;

  if ((st = tmc2209_read_reg(addr, TMC2209_REG_IOIN, &ioin)) != TMC2209_OK)
    return st;
  if ((ioin >> 24) != TMC2209_VERSION)
    return TMC2209_WRONG_CHIP;

  if ((st = tmc2209_read_reg(addr, TMC2209_REG_IFCNT, &ifcnt0)) != TMC2209_OK)
    return st;

  /* UART owns PDN pin, microsteps from MRES, current still set by VREF pot */
  if ((st = tmc2209_write_reg(addr, TMC2209_REG_GCONF,
                              GCONF_I_SCALE_ANALOG | GCONF_PDN_DISABLE |
                              GCONF_MSTEP_REG_SELECT | GCONF_MULTISTEP_FILT)) != TMC2209_OK)
    return st;

  if ((st = tmc2209_read_reg(addr, TMC2209_REG_CHOPCONF, &chopconf)) != TMC2209_OK)
    return st;
  chopconf &= ~CHOPCONF_MRES_MASK;
  chopconf |= ((uint32_t)mres << CHOPCONF_MRES_POS) | CHOPCONF_INTPOL;
  if ((st = tmc2209_write_reg(addr, TMC2209_REG_CHOPCONF, chopconf)) != TMC2209_OK)
    return st;

  /* IFCNT (8 bit, wraps) counts successful writes: expect +2 */
  if ((st = tmc2209_read_reg(addr, TMC2209_REG_IFCNT, &ifcnt1)) != TMC2209_OK)
    return st;
  if ((uint8_t)(ifcnt1 - ifcnt0) != 2U)
    return TMC2209_VERIFY_ERROR;

  if ((st = tmc2209_read_reg(addr, TMC2209_REG_CHOPCONF, &chopconf)) != TMC2209_OK)
    return st;
  if (((chopconf & CHOPCONF_MRES_MASK) >> CHOPCONF_MRES_POS) != (uint32_t)mres)
    return TMC2209_VERIFY_ERROR;

  /* Clear reset / drv_err / uv_cp flags (write 1 to clear) */
  return tmc2209_write_reg(addr, TMC2209_REG_GSTAT, 0x7U);
}
