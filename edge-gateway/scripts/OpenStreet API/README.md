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

### main.py
- Standalone local test script (not the Flask server).
- Uses a fixed sample location and calls `service.py`.
- Prints:
  - nearest named river/stream
  - nearest gauging station
- Useful for quick terminal verification of the same flow used by `api.py`.

