# hardware_gps.py - This module reads GPS data from a hardware GPS device connected via serial port.
import serial

def get_hardware_gps(port="/dev/ttyUSB0", baud=9600):
    ser = serial.Serial(port, baud, timeout=1)

    while True:
        line = ser.readline().decode('utf-8', errors='ignore')

        if "$GPGGA" in line:
            parts = line.split(",")

            lat = parts[2]
            lon = parts[4]
            alt = parts[9]

            return {
                "latitude": lat,
                "longitude": lon,
                "altitude": alt
            }