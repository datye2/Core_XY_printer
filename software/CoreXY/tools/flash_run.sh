#!/usr/bin/env bash
# Flash the firmware and fire one stepper test move, in a single command.
# Distances are whole mm, speed in mm/s.
#
#   ./tools/flash_run.sh                 # 20 mm along X at 20 mm/s
#   ./tools/flash_run.sh 20 20 30        # dx, dy, speed: diagonal, motor A only
#   ./tools/flash_run.sh -20 0 20        # negative = other direction
#   NOFLASH=1 ./tools/flash_run.sh 10 0  # reuse what is already on the chip
#
# Symbol addresses are read from the .elf every time, so they stay correct
# after a rebuild.
set -euo pipefail

cd "$(dirname "$0")/.."
ELF=build/Debug/CoreXY.elf
DX=${1:-20}
DY=${2:-0}
SPEED=${3:-20}

[ -f "$ELF" ] || { echo "no $ELF — run: cmake --build build/Debug"; exit 1; }

addr_of() {
  local a
  a=$(nm "$ELF" | awk -v s="$1" '$3 == s {print $1}')
  [ -n "$a" ] || { echo "symbol $1 not found in $ELF" >&2; exit 1; }
  echo "0x$a"
}

A_DX=$(addr_of step_test_dx)
A_DY=$(addr_of step_test_dy)
A_SPEED=$(addr_of step_test_speed)
A_RUN=$(addr_of step_test_run)

# Two's complement for negative values (mww takes a 32-bit word).
word() { if [ "$1" -lt 0 ]; then echo $(( 4294967296 + $1 )); else echo "$1"; fi; }

echo "dx=$DX dy=$DY speed=$SPEED  run flag at $A_RUN"

CMDS=()
if [ "${NOFLASH:-0}" != "1" ]; then
  CMDS+=(-c "program $ELF verify reset")
fi
CMDS+=(-c "sleep 500")            # let startup clear .bss and run tmc_setup
CMDS+=(-c "halt")
CMDS+=(-c "mww $A_DX $(word "$DX")")
CMDS+=(-c "mww $A_DY $(word "$DY")")
CMDS+=(-c "mww $A_SPEED $(word "$SPEED")")
CMDS+=(-c "mwb $A_RUN 1")         # one byte: the flag is a uint8_t
CMDS+=(-c "resume")
CMDS+=(-c "shutdown")

exec openocd -f interface/stlink.cfg -f target/stm32h7x.cfg "${CMDS[@]}"
