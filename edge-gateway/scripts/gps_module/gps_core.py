def process_location(gps_data):
    if gps_data:
        lat = gps_data["latitude"]
        lon = gps_data["longitude"]
        alt = gps_data["altitude"]

        print(f"Latitude: {lat}")
        print(f"Longitude: {lon}")
        print(f"Altitude: {alt}")
    else:
        print("No GPS data available")