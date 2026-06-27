### Fi;e Usage
This folder scripts is for fetching the GPS sensor Data and respond with the following values

data = {
    "latitude": msg.latitude,
    "longitude": msg.longitude,
    "altitude": float(msg.altitude),
    "satellites": int(msg.num_sats)
}

