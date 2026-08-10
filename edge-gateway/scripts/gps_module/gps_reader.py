import serial
import pynmea2


class GPSReader:

    def __init__(self, port='COM5', baudrate=115200):
        self.serial_port = serial.Serial(
            port,
            baudrate,
            timeout=1
        )

    def get_gps_data(self):

        while True:
            try:
                line = self.serial_port.readline().decode(
                    'ascii',
                    errors='ignore'
                ).strip()

                if not line:
                    continue

                # print("Received:", line)

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