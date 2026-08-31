import os
from .gps_reader import GPSReader

GPS_PORT = os.environ.get("GPS_PORT", "/dev/ttyUSB0")
GPS_BAUD = int(os.environ.get("GPS_BAUDRATE", "115200"))

gps = GPSReader(GPS_PORT, GPS_BAUD)

print("Waiting for GPS data...")

data = gps.get_gps_data()

print("GPS Data:")
print(data)