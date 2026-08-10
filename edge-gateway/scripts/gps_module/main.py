from gps_reader import GPSReader


gps = GPSReader('COM5', 115200)

print("Waiting for GPS data...")

data = gps.get_gps_data()

print("GPS Data:")
print(data)