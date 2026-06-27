# OpenStreet API Module

This folder contains a small Python module that finds:
- the nearest named river/stream to a GPS point
- the nearest water-level gauging station

It uses OpenStreetMap Overpass API data.

## Files and How They Work

### api.py
- Flask entrypoint for HTTP access.
- Exposes:
  - `GET /health` -> health check
  - `GET /nearest-river-gauging-station?lat=<value>&lon=<value>`
- Flow:
  1. Validates `lat` and `lon`
  2. Calls `find_nearest_river_and_station(...)` from `service.py`
  3. Returns combined JSON response

### service.py
- Shared application service layer.
- Contains `find_nearest_river_and_station(latitude, longitude)`.
- Orchestrates the full lookup flow:
  1. nearest named river from `providers/river_lookup.py` using nearest river-segment point
  2. nearest gauging station from `providers/gauging_station.py` (river point first, then query-point fallback)
- Used by both `api.py` and `main.py`.

### providers/river_lookup.py
- Contains `get_nearest_named_river(latitude, longitude, radius_m=5000)`.
- Queries Overpass for nearby `waterway=river` and `waterway=stream` ways with geometry.
- Uses Shapely to project the query point onto each river polyline and compute nearest-point distance.
- Keeps only named rivers/streams and returns the closest one.
- Returns `(result, None)` on success or `(None, error_dict)` on failure.

### providers/gauging_station.py
- Contains `get_nearest_waterlevel_station(latitude, longitude, radius_m=10000, query_point=None)`.
- Queries Overpass for water-level monitoring/gauging features (nodes, ways, relations) with expanded tag filters.
- Extracts coordinates from element `lat/lon` or `center`.
- Uses staged search radii and fallback center points:
  1. nearest-river point
  2. original query point
- Calculates geodesic distance to the original query location and returns nearest station details.
- Returns `(result, None)` on success or `(None, error_dict)` on failure.

### providers/overpass_client.py
- Shared Overpass HTTP client used by provider modules.
- Adds simple retry and fallback endpoint behavior to reduce temporary 504/timeout failures.

### scripts/gps_module/gps_reader.py
- Function to get the GPS cordinants from the GPS sensor from ESP 32
- main.py file run the gps_reader.py file function in ESP 32 and respond with data = {"latitude": msg.latitude,"longitude": msg.longitude,"altitude": float(msg.altitude),"satellites": int(msg.num_sats)}

### main.py
- Standalone local test script (not the Flask server).
- Uses a fixed sample location and calls `service.py`.
- Prints:
  - nearest named river/stream
  - nearest gauging station
- Useful for quick terminal verification of the same flow used by `api.py`.

## Quick Run

Install dependencies (inside your active environment):

```bash
pip install -r requirements.txt
```

Run API server:

```bash
python OpoenStreet API/api.py
```

Test endpoint example:

```bash
curl "http://127.0.0.1:5000/nearest-river-gauging-station?lat=6.501&lon=81.398"
```

## Activate Venv (PowerShell)

```powershell
.\.venv\Scripts\Activate.ps1
```


## River Gauging Station Gauge measure Site Link
https://www.arcgis.com/apps/dashboards/2cffe83c9ff5497d97375498bdf3ff38

# River Level Gauging
https://www.arcgis.com/apps/dashboards/2cffe83c9ff5497d97375498bdf3ff38

# Latitude Checking Link
https://api.open-elevation.com/api/v1/lookup?locations=41.161758,-8.583933

