import serial
import pynmea2
import os

PORT = os.environ["GPS_PORT"]
BAUDRATE = int(os.environ["GPS_BAUDRATE"])

class GPSReader:

    def __init__(self, port=PORT, baudrate=BAUDRATE):
        self.serial_port = serial.Serial(
            port,
            baudrate,
            timeout=1
        )

    def get_gps_data(self, max_lines=50):
        """Read up to max_lines serial lines looking for a valid NMEA fix.
        Returns dict on success, None if no fix found within the limit."""
        attempts = 0
        while attempts < max_lines:
            attempts += 1
            try:
                line = self.serial_port.readline().decode(
                    'ascii',
                    errors='ignore'
                ).strip()

                if not line:
                    continue

                if line.startswith('$GPGGA') or line.startswith('$GNGGA'):

                    msg = pynmea2.parse(line)

                    # GPS fix available
                    if msg.latitude and msg.longitude:

                        return {
                            "latitude": msg.latitude,
                            "longitude": msg.longitude,
                            "altitude": float(msg.altitude or 0),
                            "satellites": int(msg.num_sats or 0)
                        }

            except Exception as e:
                print("GPS Error:", e)

        return None