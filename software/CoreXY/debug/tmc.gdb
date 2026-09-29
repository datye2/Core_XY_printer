# GDB script for debugging the CoreXY board over ST-Link (OpenOCD).
#
#   1) start the gdb server:
#        openocd -f interface/stlink.cfg -f target/stm32h7x.cfg
#   2) in another terminal:
#        gdb-multiarch build/Debug/CoreXY.elf -x debug/tmc.gdb
#
#   With a J-Link instead: start
#        JLinkGDBServerCLExe -device STM32H743II -if SWD -speed 4000 -port 2331 -nogui
#   and change the port below from 3333 to 2331.

set confirm off
set pagination off
set print pretty on
set mem inaccessible-by-default off

target extended-remote :3333
monitor reset halt

# --- helpers -----------------------------------------------------------

# tmc <0|1>   : state of one driver (0 = motor A, 1 = motor B)
define tmc
  printf "init_status = %d, read_status = %d, refresh = %u\n", \
         tmc_dbg[$arg0].init_status, tmc_dbg[$arg0].read_status, tmc_dbg[$arg0].refresh_count
  printf "IOIN     = 0x%08X  (version = 0x%02X, expect 0x21)\n", \
         tmc_dbg[$arg0].ioin, (tmc_dbg[$arg0].ioin >> 24) & 0xFF
  printf "GCONF    = 0x%08X  (expect 0x1C1)\n", tmc_dbg[$arg0].gconf
  printf "CHOPCONF = 0x%08X  (MRES = %u, expect 4)\n", \
         tmc_dbg[$arg0].chopconf, (tmc_dbg[$arg0].chopconf >> 24) & 0xF
  printf "GSTAT    = 0x%08X  (bit0 reset)\n", tmc_dbg[$arg0].gstat
  printf "IFCNT    = %u\n", tmc_dbg[$arg0].ifcnt
end
document tmc
Print the state of one TMC2209: tmc 0 (motor A) or tmc 1 (motor B).
end

# bus : bytes of the last UART transaction
define bus
  printf "stage = %u (0 ok, 1 transmit, 2 receive)\n", tmc2209_dbg.stage
  printf "rx_count = %u / %u expected\n", tmc2209_dbg.rx_count, tmc2209_dbg.rx_expected
  printf "tx = "
  output/x tmc2209_dbg.tx
  printf "\nrx = "
  output/x tmc2209_dbg.rx
  printf "\nUSART3 ISR = 0x%08X, CR1 = 0x%08X, BRR = 0x%08X\n", \
         *(unsigned int *)0x4000481C, *(unsigned int *)0x40004800, *(unsigned int *)0x4000480C
end
document bus
Print the last TMC2209 UART transaction: stage, byte counts, tx/rx bytes, USART3 flags.
end

# reinit : run tmc2209_init again from the firmware side
define reinit
  set var tmc_dbg_reinit = 1
  printf "tmc_dbg_reinit = 1, continue to run init again\n"
end

# stop on a failed receive and show the bytes
define trap
  break tmc2209.c:transfer if tmc2209_dbg.stage == 2
  printf "breakpoint set on transfer()\n"
end

# --- default watches ---------------------------------------------------
# shown automatically every time the target halts
display/d tmc_dbg[0].init_status
display/d tmc_dbg[1].init_status
display/d tmc2209_dbg.rx_count

printf "\nCommands: tmc 0 | tmc 1 | bus | reinit | trap\n\n"
