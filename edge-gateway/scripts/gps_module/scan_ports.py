import serial
import time
import os

SERIAL_PORT = os.environ.get("GPS_PORT", "/dev/ttyUSB1")
ports = [SERIAL_PORT, '/dev/ttyACM0', '/dev/ttyAMA0']
bauds = [9600, 115200, 57600, 38400]

for port in ports:
    for baud in bauds:
        try:
            ser = serial.Serial(port, baud, timeout=2)
            time.sleep(0.5)
            data = ser.readline()
            ser.close()
            if data:
                text = data.decode('utf-8', errors='replace').strip()
                print(f"  {port} @ {baud}: {text[:100]}")
            else:
                print(f"  {port} @ {baud}: (no data)")
        except Exception as e:
            print(f"  {port} @ {baud}: {e}")
