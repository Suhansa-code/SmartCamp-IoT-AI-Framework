# gps_reader.py

import serial
from pynmea2 import parse


class GPSReader:
    def __init__(self, port='COM7', baudrate=9600):
        self.serial_port = serial.Serial(port, baudrate, timeout=1)

    def get_gps_data(self):
        while True:
            try:
                line = self.serial_port.readline().decode('utf-8', errors='ignore')

                if line.startswith('$GPGGA') or line.startswith('$GNGGA'):

                    msg = parse(line)

                    if msg.latitude and msg.longitude:

                        data = {
                            "latitude": msg.latitude,
                            "longitude": msg.longitude,
                            "altitude": float(msg.altitude),
                            "satellites": int(msg.num_sats)
                        }

                        return data

            except Exception as e:
                print("GPS Error:", e)