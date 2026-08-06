import serial
import sys

port = sys.argv[1] if len(sys.argv) > 1 else 'COM5'
baud = int(sys.argv[2]) if len(sys.argv) > 2 else 115200

print(f"Opening {port} at {baud} baud...")
print("Reading raw data for 10 seconds (Ctrl+C to stop):\n")

ser = serial.Serial(port, baud, timeout=2)
import time
end = time.time() + 10
count = 0
while time.time() < end:
    raw = ser.readline()
    if raw:
        count += 1
        text = raw.decode('utf-8', errors='replace').strip()
        print(f"  [{count}] {text}")
    else:
        print(f"  (no data - timeout)")

ser.close()
print(f"\nDone. Received {count} lines total.")
