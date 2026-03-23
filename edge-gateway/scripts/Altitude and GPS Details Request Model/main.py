import requests
import socket

def get_location():
    try:
        # Get public IP location data
        response = requests.get("https://ipinfo.io/json")
        data = response.json()

        ip = data.get("ip")
        city = data.get("city")
        region = data.get("region")
        country = data.get("country")
        loc = data.get("loc")  # latitude,longitude

        latitude, longitude = loc.split(",")

        # Get elevation using open-elevation API
        elevation_response = requests.get(
            f"https://api.open-elevation.com/api/v1/lookup?locations={latitude},{longitude}"
        )
        elevation_data = elevation_response.json()
        elevation = elevation_data["results"][0]["elevation"]

        print("\n--- Laptop Location Details ---")
        print(f"Public IP: {ip}")
        print(f"City: {city}")
        print(f"Region: {region}")
        print(f"Country: {country}")
        print(f"Latitude: {latitude}")
        print(f"Longitude: {longitude}")
        print(f"Approx. Altitude above sea level: {elevation} meters")

    except Exception as e:
        print("Error getting location data:", e)

if __name__ == "__main__":
    get_location()