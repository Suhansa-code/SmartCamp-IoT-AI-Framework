from phone_gps import get_phone_gps
from gps_core import process_location

PHONE_URL = "https://10.31.96.70:8080/sensors.html"

# gps_data = get_hardware_gps() <---- Enable this line to use hardware GPS instead of phone GPS
gps_data = get_phone_gps(PHONE_URL)
process_location(gps_data)