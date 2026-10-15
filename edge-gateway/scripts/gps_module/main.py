import os
from .gps_reader import GPSReader

GPS_PORT = os.environ["GPS_PORT"]
GPS_BAUD = int(os.environ["GPS_BAUDRATE"])

gps = GPSReader(GPS_PORT, GPS_BAUD)

print("Waiting for GPS data...")

data = gps.get_gps_data()

print("GPS Data:")
print(data)