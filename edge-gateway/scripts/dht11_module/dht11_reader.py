import serial
import glob
import json
import re


class DHT11Reader:

    def __init__(self, port=None, baudrate=9600):
        if port is None:
            port = self._detect_esp32_port()
        self.serial_port = serial.Serial(port, baudrate, timeout=2)

    @staticmethod
    def _detect_esp32_port():
        candidates = glob.glob('/dev/ttyUSB*') + glob.glob('/dev/ttyACM*')
        if candidates:
            return candidates[0]
        raise serial.SerialException(
            "No ESP32 serial device found. "
            "Checked /dev/ttyUSB* and /dev/ttyACM*."
        )

    def get_dht11_data(self):
        while True:
            try:
                line = self.serial_port.readline().decode(
                    'utf-8',
                    errors='ignore'
                ).strip()

                if not line:
                    continue

                data = self._parse_line(line)
                if data is not None:
                    return data

            except serial.SerialException:
                raise
            except Exception as e:
                print("DHT11 Error:", e)

    def _parse_line(self, line):
        try:
            obj = json.loads(line)
            temp = obj.get("temperature")
            hum = obj.get("humidity")
            if temp is not None and hum is not None:
                return {
                    "temperature": float(temp),
                    "relative_humidity": float(hum)
                }
        except (json.JSONDecodeError, ValueError):
            pass

        match = re.search(
            r'temp(?:erature)?[:\s]*([0-9.]+).*?hum(?:idity)?[:\s]*([0-9.]+)',
            line,
            re.IGNORECASE
        )
        if match:
            return {
                "temperature": float(match.group(1)),
                "relative_humidity": float(match.group(2))
            }

        parts = line.split(',')
        if len(parts) == 2:
            try:
                temp = float(parts[0].strip())
                hum = float(parts[1].strip())
                return {
                    "temperature": temp,
                    "relative_humidity": hum
                }
            except ValueError:
                pass

        return None
