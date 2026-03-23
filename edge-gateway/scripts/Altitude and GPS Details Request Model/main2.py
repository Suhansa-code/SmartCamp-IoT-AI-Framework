import asyncio
from windows.devices.geolocation import Geolocator

async def get_location():
    locator = Geolocator()
    pos = await locator.get_geoposition_async()
    coord = pos.coordinate

    print("Latitude:", coord.point.position.latitude)
    print("Longitude:", coord.point.position.longitude)
    print("Altitude (meters):", coord.point.position.altitude)

asyncio.run(get_location())