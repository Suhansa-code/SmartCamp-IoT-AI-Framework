# OpenStreet API Module

This folder contains a small Python module that finds:
- the nearest named river/stream to a GPS point
- the nearest water-level gauging station

It uses OpenStreetMap Overpass API data.

## Files and How They Work

### api.py
- FASTAPI for HTTP access.
- Exposes:
  - `GET /health` -> health check
  - `GET /nearest-river-gauging-station?lat=<value>&lon=<value>`
- Flow:
  1. Validates `lat` and `lon`
  2. Calls `find_nearest_river_and_station(...)` from `service.py`
  3. Returns combined JSON response

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
## Run Uvicorn
running code --> uvicorn api:app --reload 
Example :
(.venv) PS C:\Users\ASUS\Desktop\SLIIT\Year 4\Research Documents - RM\Smart Camp Box -Repo\SmartCamp-IoT-AI-Framework\edge-gateway\scripts> uvicorn api:app --reload 

Running URL : http://127.0.0.1:8000
Example Request : http://127.0.0.1:8000/hydrospatial/nearest-river-gauging-station?lat=7.507&lon=80.945


## River Gauging Station Gauge measure Site Link
https://www.arcgis.com/apps/dashboards/2cffe83c9ff5497d97375498bdf3ff38

# River Level Gauging
https://www.arcgis.com/apps/dashboards/2cffe83c9ff5497d97375498bdf3ff38

# Latitude Checking Link
https://api.open-elevation.com/api/v1/lookup?locations=41.161758,-8.583933

