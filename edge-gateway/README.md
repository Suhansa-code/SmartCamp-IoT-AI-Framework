# Edge Gateway

Local compute layer running on the SmartCamp edge device (Raspberry Pi / Intel NUC). Handles GPS reading, hydrospatial lookups, digital elevation analysis, and ML flood prediction — all without requiring cloud connectivity.

---

## Architecture

```
                        ┌──────────────────────────────────────────────────┐
                        │              edge-gateway/                       │
                        │                                                  │
  ┌──────────┐          │  ┌─────────────┐    ┌──────────────────────────┐ │
  │ NEO-8    │  serial  │  │ gps_module/ │    │   prediction-models/     │ │
  │ GPS ─────┼──────────┼─>│ gps_reader  │    │                          │ │
  └──────────┘          │  └──────┬──────┘    │  base_model.py           │ │
                        │         │           │  model_comparison.py     │ │
                        │         │ lat/lon   │                          │ │
                        │         v           │  ┌────────────────────┐  │ │
                        │  ┌──────────────┐   │  │  xgboost_model/    │  │ │
                        │  │ hydrospatial │   │  │  random_forest/    │  │ │
                        │  │   _api/      │   │  │  decision_tree/    │  │ │
                        │  │              │   │  │  logistic_reg/     │  │ │
                        │  │  river ──────┼───┼──│                    │  │ │
                        │  │  station ────┼───┼──│  predict_flood.py  │  │ │
                        │  │  forecast ───┼───┼──│  (stdin -> stdout) │  │ │
                        │  │  live_gauge──┼───┼──│                    │  │ │
                        │  └──────┬───────┘   │  └────────────────────┘  │ │
                        │         │           └──────────┬───────────────┘ │
                        │         v                      v                 │
                        │  ┌──────────────┐    ┌──────────────────┐       │
                        │  │ digital_     │    │  resources/      │       │
                        │  │ elevation_   │    │  gauging_stations│       │
                        │  │ model/       │    │  waterways.shp   │       │
                        │  │ (DEM raster) │    │  flood_dataset   │       │
                        │  └──────────────┘    └──────────────────┘       │
                        │                                                  │
                        │  ┌──────────────┐                               │
                        │  │ scripts/     │                               │
                        │  │ api.py       │  <-- FastAPI entry point      │
                        │  └──────────────┘                               │
                        └──────────────────────────────────────────────────┘
                                              │
                                              │ HTTP (port 8000)
                                              v
                                    ┌─────────────────┐
                                    │  Node.js Backend │
                                    │  /api/disaster/* │
                                    └─────────────────┘
```

---

## Directory Structure

```
edge-gateway/
├── scripts/                         # Runtime services
│   ├── api.py                       # FastAPI entry point (port 8000)
│   ├── requirements.txt             # Python dependencies
│   ├── gps_module/                  # GPS serial reader
│   │   ├── gps_reader.py            # Core GPS class + CLI
│   │   ├── main.py                  # Raw NMEA serial dump
│   │   ├── debug_serial.py          # Serial port debugging tool
│   │   └── scan_ports.py            # COM port scanner
│   ├── hydrospatial_api/            # River/station/weather lookups
│   │   ├── api.py                   # FastAPI router
│   │   ├── service.py               # Orchestration layer
│   │   ├── main.py                  # CLI payload builder
│   │   └── providers/
│   │       ├── overpass_client.py    # Overpass API HTTP client
│   │       ├── river_lookup.py       # Nearest river finder
│   │       ├── gauging_station.py    # Nearest station finder
│   │       ├── river_shapefile.py    # Graph-based upstream analysis
│   │       ├── live_water_level_api.py  # ArcGIS live gauge data
│   │       └── weather_forecast_location.py  # Open-Meteo forecast
│   └── digital_elevation_model/     # Terrain elevation
│       ├── digital_elevation_algorithm.py  # DEM raster reader
│       ├── open_elevation_api.py    # API fallback
│       └── main.py                  # Test script
├── prediction-models/               # ML flood prediction
│   ├── base_model.py                # Abstract base class
│   ├── model_comparison.py          # Evaluation & comparison tool
│   ├── models/                      # Serialized .pkl artifacts
│   ├── xgboost_model/               # Best performer (ROC-AUC: 0.927)
│   ├── random_forest_model/         # Second best (ROC-AUC: 0.886)
│   ├── decision_tree_model/
│   ├── logistic_regression_model/
│   ├── comparison_results/          # Generated benchmark reports
│   └── resources/                   # (uses ../resources/)
└── resources/                       # Static data files
    ├── gauging_stations.csv         # 43 Sri Lankan stations
    ├── gis_osm_waterways_free_1.shp # River network shapefile
    └── sri_lanka_flood_risk_dataset_25000.csv  # Training dataset
```

---

## 1. GPS Module (`scripts/gps_module/`)

Reads NMEA GPS data from a serial-connected GPS receiver (NEO-8 via ESP32 or USB-to-serial adapter).

### Files

| File | Purpose |
|------|---------|
| `gps_reader.py` | Core `GPSReader` class + CLI entry point. Parses `$GPGGA`/`$GNGGA` NMEA sentences. |
| `main.py` | Raw NMEA serial dump for debugging. |
| `debug_serial.py` | Reads raw serial for 10 seconds, prints each line with count. |
| `scan_ports.py` | Scans COM3-COM5 at 9600/115200/57600/38400 to find active GPS. |

### `gps_reader.py`

**Class:** `GPSReader(port='COM5', baudrate=115200)`

**Method:** `get_gps_data()` -> `dict`

**Output:**
```json
{
    "latitude": 7.507,
    "longitude": 80.945,
    "altitude": 10.0,
    "satellites": 8
}
```
Returns `{"latitude": null, "error": "No GPS fix"}` on failure.

**Run as CLI:**
```bash
python gps_reader.py [COM_PORT] [BAUD_RATE]
# Example:
python gps_reader.py COM5 115200
```

### `debug_serial.py`

**Run:**
```bash
python debug_serial.py [PORT] [BAUD]
# Example:
python debug_serial.py COM5 115200
```

**Output:** Prints each raw serial line received over 10 seconds with a running count.

### `scan_ports.py`

**Run:**
```bash
python scan_ports.py
```

**Output:** Tests every COM port at every baud rate, reports which combinations yield data.

### Hardware Wiring

| NEO-8 GPS Pin | ESP32 Pin |
|---------------|-----------|
| TX | GPIO16 (RX2) |
| RX | GPIO17 (TX2) |
| VCC | 3.3V |
| GND | GND |

**Requirements:** ESP32 must have `gps_bridge.ino` firmware uploaded (in `sensor-node/gps_bridge/`).

---

## 2. Hydrospatial API (`scripts/hydrospatial_api/`)

Orchestrates river lookup, gauging station discovery, live water levels, and weather forecasts for a GPS coordinate. Uses OpenStreetMap Overpass API, ArcGIS REST, and Open-Meteo.

### Files

| File | Purpose |
|------|---------|
| `api.py` | FastAPI router with `/health` and `/nearest-river-gauging-station` endpoints. |
| `service.py` | Orchestration layer — coordinates all providers. |
| `main.py` | CLI tool — builds complete live payload for a coordinate. |
| `providers/overpass_client.py` | Shared Overpass API HTTP client with retry + failover. |
| `providers/river_lookup.py` | Finds nearest named river via Overpass. |
| `providers/gauging_station.py` | Finds nearest water-level station via Overpass. |
| `providers/river_shapefile.py` | Graph-based upstream station finder using shapefiles. |
| `providers/live_water_level_api.py` | Fetches live gauge readings from ArcGIS REST. |
| `providers/weather_forecast_location.py` | Fetches 1-day forecast from Open-Meteo. |

### `api.py` — FastAPI Router

**Endpoints:**

| Method | Path | Params | Description |
|--------|------|--------|-------------|
| GET | `/health` | — | `{"status": "ok"}` |
| GET | `/nearest-river-gauging-station` | `lat`, `lon` | Nearest river + station for a coordinate |

**Run standalone:**
```bash
cd scripts/
uvicorn api:app --reload --port 8000
```

### `main.py` — CLI Payload Builder

**Run:**
```bash
# Manual coordinates:
python main.py --lat 7.507 --lon 80.945 --alt 10.0 --json

# From GPS serial:
python main.py --use-gps --gps-port COM5 --gps-baudrate 115200

# Human-readable output:
python main.py --lat 7.507 --lon 80.945
```

**Output (JSON):**
```json
{
    "query_location": { "lat": 7.507, "lon": 80.945, "alt": 10.0 },
    "nearest_river": { "name": "Kelani Ganga", "distance_km": 2.3, "coordinates": [7.51, 80.95] },
    "gauging_station": { "station_name": "Hanwella", "river_name": "Kelani Ganga", "distance_to_station_meters": 15200 },
    "live_gauge_data": { "water_level": 2.3, "rainfall": 12.5, "alert_level": 3.5, "minor_flood_level": 5.5, "major_flood_level": 7.0 },
    "forecast": { "weather_forecast_parameters": { "hourly": { "temperature_2m": [...], "precipitation": [...] } } },
    "forecast_summary": { "min_temp": 23.1, "max_temp": 31.5, "total_precipitation_mm": 45.2, "max_hourly_precip_mm": 12.3 },
    "errors": {}
}
```

### Providers

#### `overpass_client.py`
- Retries each Overpass endpoint 2x with exponential backoff
- Failover: `overpass-api.de` -> `overpass.kumi.systems`
- No external dependencies (stdlib only)

#### `river_lookup.py`
- Queries `waterway=river` + `waterway=stream` within 50km radius
- Only considers named rivers
- Uses Shapely to find nearest point on river polyline
- Output: `{name, distance_km, coordinates, osm_id}`

#### `gauging_station.py`
- Staged search: tries nearest-river point, then original query point
- Expanding radii: 10km -> 20km -> 30km
- Searches for monitoring station, water level, river gauge tags
- Output: `{name, distance_km, osm_id, operator, coordinates}`

#### `river_shapefile.py`
- Loads `resources/gis_osm_waterways_free_1.shp`
- Builds directed NetworkX graph from river segments
- Reverses graph + Dijkstra to find upstream gauging stations
- Uses `resources/gauging_stations.csv` for station data
- CRS: EPSG:32644 (Sri Lanka UTM Zone 44N)

#### `live_water_level_api.py`
- Queries ArcGIS FeatureServer for gauge readings
- `get_gauge_data(name)` — full history scan
- `get_latest_gauge_data(name)` — optimized single record
- Output: `{water_level, rainfall, alert_level, minor/major_flood_level}`

#### `weather_forecast_location.py`
- Open-Meteo API, 1-day hourly forecast
- 11 parameters: temperature, humidity, precipitation, rain, wind, soil moisture, pressure, cloud cover
- Output: `{forecast_location, weather_forecast_parameters}`

---

## 3. Digital Elevation Model (`scripts/digital_elevation_model/`)

Reads terrain elevation from a local DEM raster file (.img format) with Open-Elevation API fallback.

### Files

| File | Purpose |
|------|---------|
| `digital_elevation_algorithm.py` | Core DEM reader — samples elevation from GeoTIFF raster. |
| `open_elevation_api.py` | Fallback — public Open-Elevation REST API. |
| `main.py` | Test script with sample point. |

### `digital_elevation_algorithm.py`

**Functions:**

| Function | Description |
|----------|-------------|
| `get_dem_elevations_batch(gps_points)` | Batch elevation lookup from local DEM raster. |
| `get_elevations_batch(gps_points, use_api_fallback=True)` | DEM with Open-Elevation fallback. |

**Input:** List of `(latitude, longitude)` tuples.

**Output:**
```python
[{
    "latitude": 7.507,
    "longitude": 80.945,
    "used_latitude": 7.507,
    "used_longitude": 80.945,
    "elevation": 81.0,
    "snap_distance_m": 0.0,
    "source": "dem",
    "error": null
}]
```

**Error values:** `outside_dem_bounds`, `nodata_pixel`, `snapped_to_nearest_pixel`

**Run:**
```bash
cd scripts/digital_elevation_model
python main.py
```

**Dependencies:** `numpy`, `rasterio`, `pyproj`

---

## 4. Prediction Models (`prediction-models/`)

Four ML models for binary flood risk prediction (Likely/Unlikely). All inherit from `BaseFloodModel` and use the same 5 features.

### Model Features

| Feature | Description |
|---------|-------------|
| `rainfall_7d_mm` | 7-day cumulative rainfall |
| `longitude` | GPS longitude |
| `latitude` | GPS latitude |
| `elevation_m` | Terrain elevation (DEM) |
| `distance_to_river_m` | Distance to nearest river |

### Model Comparison Results

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|-------|----------|-----------|--------|-----|---------|
| **XGBoost** | **0.824** | **0.350** | **0.893** | **0.503** | **0.927** |
| Random Forest | 0.800 | 0.309 | 0.811 | 0.447 | 0.886 |
| Decision Tree | 0.697 | 0.225 | 0.831 | 0.354 | 0.840 |
| Logistic Regression | 0.709 | 0.206 | 0.674 | 0.316 | 0.776 |

### Files

| File | Purpose |
|------|---------|
| `base_model.py` | Abstract base — train, evaluate, predict, save. |
| `model_comparison.py` | Benchmark all models, generate reports. |
| `models/*.pkl` | Serialized trained models. |
| `comparison_results/` | Benchmark CSV + JSON reports. |

### Per-Model Structure

Each model directory (`xgboost_model/`, `random_forest_model/`, etc.) contains:

| File | Purpose |
|------|---------|
| `*_model.py` | Model class extending `BaseFloodModel`. |
| `predict_flood.py` | CLI prediction via stdin/stdout JSON (XGBoost only). |
| `artifacts/` | ROC curve, PR curve, confusion matrix PNGs. |

### Training a Model

```bash
cd prediction-models/xgboost_model
python xgboost_model.py
```

Output: AUC score + sample prediction. Saves model to `models/xgboost_model.pkl`.

### Running Comparison

```bash
cd prediction-models
python model_comparison.py --generate-report
```

Output: `comparison_results/model_comparison_summary.json` + CSV + visualization PNGs.

### XGBoost Prediction (stdin/stdout)

**Run:**
```bash
echo '{"rainfall_mm":160,"longitude":80.945,"latitude":7.507,"altitude_m":88,"dem_elevation_m":81,"nearest_river_m":350,"gauging_station_current_water_level_m":2.3,"is_forecast":true}' | python predict_flood.py
```

**Output:**
```json
{
    "flood_possibility": "Likely",
    "category": "High",
    "future_forecast": {"enabled": true, "probability": 0.82, "category": "High"},
    "probability": 0.78,
    "source": "xgboost_baseline_v1"
}
```

### Prediction Probability Adjustment

The model adjusts base probability based on:
- **Current water level:** correction = `clip((water_level - 2.0) * 0.05, -0.12, 0.25)`
- **Forecast modifier:** `clip(adjusted * 1.10 + 0.03, 0.0, 1.0)` if `is_forecast=true`

### Categories

| Probability | Category |
|-------------|----------|
| >= 0.70 | High |
| >= 0.40 | Medium |
| < 0.40 | Low |

---

## 5. Resources (`resources/`)

| File | Format | Records | Description |
|------|--------|---------|-------------|
| `sri_lanka_flood_risk_dataset_25000.csv` | CSV | 25,000 | Training dataset with 32 columns |
| `gauging_stations.csv` | CSV | 43 | Station coordinates + flood thresholds |
| `gis_osm_waterways_free_1.shp` + `.shx` | Shapefile | — | OSM river network for Sri Lanka |

### Training Dataset Columns

Target: `flood_occurrence_current_event` ("Yes"/"No")

Features: `rainfall_7d_mm`, `longitude`, `latitude`, `elevation_m`, `distance_to_river_m`

Full columns: `record_id`, `district`, `place_name`, `latitude`, `longitude`, `elevation_m`, `distance_to_river_m`, `landcover`, `soil_type`, `water_supply`, `electricity`, `road_quality`, `population_density_per_km2`, `built_up_percent`, `urban_rural`, `rainfall_7d_mm`, `monthly_rainfall_mm`, `drainage_index`, `ndvi`, `ndwi`, `water_presence_flag`, `historical_flood_count`, `infrastructure_score`, `nearest_hospital_km`, `nearest_evac_km`, `flood_risk_score`, `flood_occurrence_current_event`, `inundation_area_sqm`, `is_good_to_live`, `reason_not_good_to_live`, `is_synthetic`, `generation_date`

---

## Setup & Installation

### Prerequisites

- Python 3.11+
- ESP32 with Arduino IDE (for GPS firmware)
- DEM raster file (`.img` format)

### Install Dependencies

```bash
cd edge-gateway/scripts
pip install -r requirements.txt
```

**Additional packages needed** (not in `scripts/requirements.txt`):

```bash
pip install rasterio pyproj xgboost scikit-learn matplotlib seaborn joblib
```

Or install the complete pinned set the container uses:

```bash
pip install -r edge-gateway/requirements.txt
```

### Run the FastAPI Server

```bash
cd edge-gateway/scripts
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

### Run with Docker (deployment)

Runs on the Intel NUC (`linux/amd64`); the image also builds on arm64.

```bash
cd edge-gateway
cp .env.example .env          # set GPS_SERIAL_PORT to the real ESP32 device
docker compose up -d --build
curl http://localhost:8000/   # {"status":"running"}
```

| File | Purpose |
|------|---------|
| `Dockerfile` | Python 3.11 image; `scripts/`, `prediction-models/` and `resources/` stay siblings under `/app` because the shapefile and model paths are resolved relative to each other. |
| `docker-compose.yml` | Single `edge-gateway` service — publishes `:8000`, hands the ESP32 serial device through, joins gid 20 (`dialout`). |
| `requirements.txt` | Complete pinned dependency set. `xgboost-cpu` avoids a 342 MB CUDA wheel; `xgboost 3.2.0` / `scikit-learn 1.4.2` match the committed `.pkl` artifacts and must be bumped together with a retrain. |
| `.env.example` | `GPS_SERIAL_PORT`, `GPS_BAUDRATE`, `RAINFALL_WIRELESS_TIMEOUT_SECONDS`, `EDGE_PORT`, `DIALOUT_GID`. |

Two things to know about the container:

- **No ESP32 attached?** Comment out the `devices:` block, or compose refuses to
  start. The API still serves hydrospatial, elevation and prediction, and
  reports the sensors disconnected.
- **DEM raster is not in the image** — `digital_elevation_algorithm.py` hardcodes
  a Windows `.img` path, so `/hydrospatial/elevation` answers from the
  Open-Elevation API fallback.

The Pi backend must point at this host, not at its own loopback:

```bash
# raspberry-platform/backend/.env
EDGE_API_URL=http://<nuc-lan-ip>:8000
```

### Test Individual Modules

```bash
# GPS reader
python scripts/gps_module/gps_reader.py COM5 115200

# Hydrospatial CLI
python scripts/hydrospatial_api/main.py --lat 7.507 --lon 80.945 --json

# DEM lookup
python scripts/digital_elevation_model/main.py

# XGBoost prediction
echo '{"rainfall_mm":160,"longitude":80.945,"latitude":7.507,"altitude_m":88,"dem_elevation_m":81,"nearest_river_m":350,"gauging_station_current_water_level_m":2.3,"is_forecast":true}' | python prediction-models/xgboost_model/predict_flood.py

# Model comparison
python prediction-models/model_comparison.py --generate-report
```

---

## Data Flow

```
GPS Coordinate
      │
      ├─> River Lookup (Overpass API)
      │     └─> nearest named river + distance
      │
      ├─> Gauging Station (Overpass API)
      │     └─> nearest monitoring station
      │
      ├─> Live Water Level (ArcGIS REST)
      │     └─> current water level, rainfall, thresholds
      │
      ├─> Weather Forecast (Open-Meteo)
      │     └─> 1-day hourly: temp, rain, wind, soil, pressure
      │
      ├─> DEM Elevation (local raster)
      │     └─> terrain elevation with API fallback
      │
      ├─> Shapefile Analysis (local shapefile + graph)
      │     └─> upstream gauging station via Dijkstra
      │
      └─> Flood Prediction (XGBoost model)
            └─> { probability, category, forecast }
```

---

## Node.js Backend Integration

The Raspberry Pi Node.js backend calls `gps_reader.py` via `child_process.execFile`:

```
GET /api/disaster/gps  -->  gps.js service  -->  gps_reader.py  -->  serial port
```

**Environment variables** (in `raspberry-platform/backend/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `GPS_PORT` | `COM5` | Serial port |
| `GPS_BAUDRATE` | `115200` | Baud rate |
