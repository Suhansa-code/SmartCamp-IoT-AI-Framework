# Edge Gateway Microservices

This folder contains the edge processing microservices running on the Intel NUC:

- **Hydrospatial API** — finds the nearest named river/stream and water-level gauging station for a GPS point using OpenStreetMap Overpass API, ArcGIS live water levels, Open-Meteo weather forecasts, and shapefile river network analysis.
- **Digital Elevation Model** — elevation lookup via algorithm + Open-Elevation API.
- **GPS Module** — serial NMEA GPS reader.

## Quick Start

```bash
pip install -r requirements.txt
uvicorn api:app --reload
```

Running on `http://127.0.0.1:8000`

Example: `http://127.0.0.1:8000/hydrospatial/nearest-river-gauging-station?lat=7.507&lon=80.945`

## File Structure

```
scripts/
├── api.py                          # FastAPI entry point (:8000)
├── requirements.txt
├── hydrospatial_api/               # River/station/weather/water-level API
│   ├── api.py                      # FastAPI router
│   ├── service.py                  # Orchestration layer
│   ├── main.py                     # CLI test tool
│   ├── README.md                   # Full provider documentation
│   └── providers/                  # Individual data sources
├── digital_elevation_model/        # Elevation calculation
└── gps_module/                     # GPS reader
```

## Resources

- River gauge dashboard: https://www.arcgis.com/apps/dashboards/2cffe83c9ff5497d97375498bdf3ff38
- Elevation API: https://api.open-elevation.com
