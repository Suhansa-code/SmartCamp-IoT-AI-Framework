import requests
from geopy.distance import geodesic
from gauging_station import get_nearest_waterlevel_station

# Camp GPS location
latitude = 6.501
longitude = 81.398

# Overpass API endpoint
overpass_url = "https://overpass-api.de/api/interpreter"

query = f"""
[out:json][timeout:60];
(
  way["waterway"="river"](around:5000,{latitude},{longitude});
  way["waterway"="stream"](around:5000,{latitude},{longitude});
);
out center tags;
"""

try:
    response = requests.get(
        overpass_url,
        params={"data": query},
        headers={"User-Agent": "OpenStreet-API-Script/1.0"},
        timeout=90,
    )

    # Raise for HTTP 4xx/5xx
    response.raise_for_status()

    # Validate content type before JSON parse
    content_type = response.headers.get("Content-Type", "")
    if "json" not in content_type.lower():
        print("Overpass did not return JSON.")
        print("HTTP:", response.status_code)
        print("Content-Type:", content_type)
        print("Body preview:", response.text[:500])
        raise SystemExit(1)

    data = response.json()

except requests.exceptions.RequestException as e:
    print("Request failed:", e)
    raise SystemExit(1)
except ValueError as e:
    # JSON decode error
    print("Failed to parse JSON:", e)
    print("Body preview:", response.text[:500] if "response" in locals() else "")
    raise SystemExit(1)

nearest_river = None
min_distance = float("inf")

for element in data.get("elements", []):
    if "center" in element:
        river_name = element.get("tags", {}).get("name", "").strip()
        if not river_name:
            continue

        river_lat = element["center"]["lat"]
        river_lon = element["center"]["lon"]

        distance = geodesic((latitude, longitude), (river_lat, river_lon)).km

        if distance < min_distance:
            min_distance = distance
            nearest_river = river_name

if nearest_river is None:
    print("No named rivers/streams found in the selected radius.")
else:
    print("Nearest River:", nearest_river)
    print("Distance (km):", round(min_distance, 3))

nearest_station, station_error = get_nearest_waterlevel_station(latitude, longitude)

if station_error:
    print("Could not fetch gauging station details:", station_error.get("error", "Unknown error"))
elif nearest_station is None:
    print("No nearby water-level gauging station found.")
else:
    print("Nearest Water-Level Gauging Station:", nearest_station["name"])
    print("Distance (km):", nearest_station["distance_km"])
    print("OSM ID:", nearest_station["osm_id"])
    print("OSM Type:", nearest_station["osm_type"])
    print("Operator:", nearest_station["operator"])
    print("Reference:", nearest_station["ref"])
    print("Coordinates:", nearest_station["coordinates"])