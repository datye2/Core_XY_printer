#!/usr/bin/env python3
"""Stream a G-code file to the board over USB CDC.

    ./tools/send_gcode.py tools/demo.gcode
    ./tools/send_gcode.py tools/demo.gcode --port /dev/ttyACM0

Flow control counts characters, the way grbl's streaming scripts do: keep
sending while the board's receive buffer still has room, rather than
waiting for "ok" after every line. Waiting line by line would drain the
planner queue and lookahead would have nothing to work with.

Ctrl-C sends '!' so the machine stops immediately.
"""
import argparse, sys, time, glob

try:
    import serial
except ImportError:
    sys.exit("need pyserial:  pip install pyserial")

RX_BUFFER = 256          # must match COMMS_RX_BUFFER in module/comms.h


def find_port():
    for pattern in ("/dev/ttyACM*", "/dev/ttyUSB*"):
        hits = sorted(glob.glob(pattern))
        if hits:
            return hits[0]
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--port", default=None)
    ap.add_argument("--status", type=float, default=1.0,
                    help="seconds between '?' status requests, 0 to disable")
    args = ap.parse_args()

    port = args.port or find_port()
    if not port:
        sys.exit("no serial port found, pass --port")

    lines = []
    with open(args.file) as f:
        for raw in f:
            s = raw.split(";")[0].strip()
            if s:
                lines.append(s)

    print(f"port {port}, {len(lines)} lines")
    ser = serial.Serial(port, 115200, timeout=0)   # CDC ignores the baud
    time.sleep(0.3)
    ser.reset_input_buffer()

    pending = []        # byte count of each line still in the board's buffer
    sent = 0
    t0 = time.time()
    last_status = 0.0
    rx = ""

    try:
        i = 0
        while i < len(lines) or pending:
            # fill the board's buffer as far as it will go
            while i < len(lines):
                data = lines[i] + "\n"
                if sum(pending) + len(data) >= RX_BUFFER:
                    break
                ser.write(data.encode())
                pending.append(len(data))
                i += 1

            # read answers
            chunk = ser.read(256).decode(errors="replace")
            if chunk:
                rx += chunk
                while "\n" in rx:
                    reply, rx = rx.split("\n", 1)
                    reply = reply.strip()
                    if not reply:
                        continue
                    if reply == "ok":
                        if pending:
                            pending.pop(0)
                        sent += 1
                        print(f"\r{sent}/{len(lines)} lines", end="", flush=True)
                    elif reply.startswith("error"):
                        if pending:
                            pending.pop(0)
                        sent += 1
                        print(f"\n{reply}  (line {sent}: {lines[sent-1]})")
                    else:
                        print(f"\n{reply}")       # status report or banner

            if args.status and time.time() - last_status > args.status:
                last_status = time.time()
                ser.write(b"?")

            time.sleep(0.002)

        print(f"\nsent in {time.time() - t0:.1f} s, waiting for the machine")
        # wait until the queue drains
        while True:
            ser.write(b"?")
            time.sleep(0.2)
            s = ser.read(256).decode(errors="replace")
            if "Idle" in s:
                break
        print(f"done in {time.time() - t0:.1f} s")

    except KeyboardInterrupt:
        ser.write(b"!")
        print("\nstopped")
    finally:
        ser.close()


if __name__ == "__main__":
    main()
