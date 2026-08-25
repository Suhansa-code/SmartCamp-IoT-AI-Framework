import serial
import glob
import json
import re
import platform


class DHT11Reader:

    def __init__(self, port=None, baudrate=9600):
        if port is None:
            port = self._detect_esp32_port()
        self.serial_port = serial.Serial(port, baudrate, timeout=2)

    def close(self):
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    @staticmethod
    def _detect_esp32_port():
        import serial.tools.list_ports
        # Try pyserial's cross-platform port listing first
        for p in serial.tools.list_ports.comports():
            desc = (p.description or '').lower()
            mfg = (p.manufacturer or '').lower()
            if any(k in desc for k in ('cp210', 'ch340', 'ftdi', 'silicon', 'esp32', 'uart', 'usb-serial')):
                return p.device
            if any(k in mfg for k in ('silicon', 'wch', 'ftdi', 'espressif')):
                return p.device
        # Fallback: Linux glob
        candidates = glob.glob('/dev/ttyUSB*') + glob.glob('/dev/ttyACM*')
        if candidates:
            return candidates[0]
        raise serial.SerialException(
            "No ESP32 serial device found. "
            "Checked all COM ports and /dev/ttyUSB* /dev/ttyACM*."
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

        # Try to extract temperature and humidity in any order
        temp_match = re.search(r'temp(?:erature)?[:\s]*([0-9.]+)', line, re.IGNORECASE)
        hum_match = re.search(r'hum(?:idity)?[:\s]*([0-9.]+)', line, re.IGNORECASE)
        if temp_match and hum_match:
            return {
                "temperature": float(temp_match.group(1)),
                "relative_humidity": float(hum_match.group(1))
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
