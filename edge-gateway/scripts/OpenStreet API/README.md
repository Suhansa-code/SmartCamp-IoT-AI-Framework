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
  1. nearest named river from `providers/river_lookup.py`
  2. nearest gauging station near that river from `providers/gauging_station.py`
- Used by both `api.py` and `main.py`.

### providers/river_lookup.py
- Contains `get_nearest_named_river(latitude, longitude, radius_m=5000)`.
- Queries Overpass for nearby `waterway=river` and `waterway=stream` ways.
- Keeps only entries with names, calculates geodesic distance, and returns the closest one.
- Returns `(result, None)` on success or `(None, error_dict)` on failure.

### providers/gauging_station.py
- Contains `get_nearest_waterlevel_station(latitude, longitude, radius_m=10000)`.
- Queries Overpass for water-level monitoring/gauging features (nodes, ways, relations).
- Extracts coordinates from element `lat/lon` or `center`.
- Calculates geodesic distance and returns nearest station details.
- Returns `(result, None)` on success or `(None, error_dict)` on failure.

### providers/overpass_client.py
- Shared Overpass HTTP client used by provider modules.
- Adds simple retry and fallback endpoint behavior to reduce temporary 504/timeout failures.

### providers/__init__.py
- Marks `providers` as a Python package.

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
pip install flask requests geopy
```

Run API server:

```bash
python api.py
```

Test endpoint example:

```bash
curl "http://127.0.0.1:5000/nearest-river-gauging-station?lat=6.501&lon=81.398"
```

## Activate Venv (PowerShell)

```powershell
.\.venv\Scripts\Activate.ps1
```
