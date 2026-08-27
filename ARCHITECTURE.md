# Smart Camp Box — System Architecture

> Last updated: 2026-08-25

---

## 1. System Overview

The Smart Camp Box (SDRC-Box) is a 4-layer IoT-AI framework for disaster relief camp management. It combines real-time sensor monitoring, flood prediction, resource management, child education tracking, and MQTT-based cloud synchronization.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Cloud Platform (AWS VM)                           │
│  PostgreSQL · Express · React · Resource Prediction         │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Raspberry Pi 5 (Camp Local Server)                │
│  SQLite × 3 · Express :5000 · Flask :5001 · React :5173    │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Intel NUC (Edge Gateway)                          │
│  FastAPI :8000 · Sensor Parsing · ML Prediction · GIS      │
├─────────────────────────────────────────────────────────────┤
│  Layer 0: ESP32 (Sensor Node)                               │
│  GPS NMEA · DHT11 · YL-83 Rain Sensor · UART Serial        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Component | Technology |
|-------|-----------|------------|
| **ESP32** | Sensor Node | Arduino, TinyGPSPlus, DHT11, YL-83/FC-37 |
| **Edge Gateway** | API Server | Python, FastAPI, uvicorn, pyserial, pynmea2 |
| **Edge Gateway** | ML Models | XGBoost, scikit-learn, NetworkX, GeoPandas |
| **Edge Gateway** | GIS Data | OSM Overpass API, ArcGIS REST, Open-Meteo |
| **RPi Backend** | API Server | Node.js, Express, better-sqlite3 |
| **RPi Backend** | ML Scoring | Flask, Python, scikit-learn |
| **RPi Backend** | Messaging | EMQX MQTT (TLS 8883) |
| **RPi Frontend** | UI | React 18, Vite, Tailwind CSS, Recharts |
| **Cloud Backend** | API Server | Node.js, Express, PostgreSQL (pg) |
| **Cloud Frontend** | Dashboard | React, Next.js |
| **Database** | Edge SQLite | camp.db, pages.db, disaster.db |
| **Database** | Cloud PostgreSQL | smartcamp_cloud |

---

## 3. Directory Structure

```
SmartCamp-IoT-AI-Framework/
├── sensor-node/
│   ├── Sensor_Bridge/Sensor_Bridge.ino       # ESP32: GPS + DHT11 + Rain → Serial
│   ├── gps_bridge/gps_bridge.ino             # GPS-only bridge
│   └── Outside ESP32/Rainfall_Sensor/        # Standalone rain test
│
├── edge-gateway/
│   ├── scripts/
│   │   ├── api.py                            # FastAPI entry (:8000)
│   │   ├── sensor_state.py                   # Persistent ESP32 reader (GPS+DHT11+Rain)
│   │   ├── hydrospatial_api/                 # River/station/water-level/weather
│   │   │   ├── api.py                        # Routes: predict, live-payload, weather
│   │   │   ├── service.py                    # Orchestration layer
│   │   │   └── providers/
│   │   │       ├── river_lookup.py           # OSM Overpass: nearest river
│   │   │       ├── gauging_station.py        # OSM Overpass: nearest station
│   │   │       ├── river_shapefile.py        # GIS shapefile + NetworkX graph
│   │   │       ├── live_water_level_api.py   # ArcGIS: live gauge readings
│   │   │       ├── weather_forecast_location.py  # Open-Meteo forecast
│   │   │       └── overpass_client.py        # Overpass HTTP client
│   │   ├── gps_module/gps_api.py             # GET /api/gps
│   │   ├── dht11_module/dht11_api.py         # GET /api/dht11
│   │   ├── rainfall_module/rainfall_api.py   # GET /api/rainfall
│   │   └── digital_elevation_model/          # DEM raster + Open-Elevation
│   ├── prediction-models/
│   │   ├── base_model.py                     # ABC: BaseFloodModel
│   │   ├── xgboost_model/                    # ★ Production (AUC=0.927)
│   │   ├── random_forest_model/
│   │   ├── decision_tree_model/
│   │   └── logistic_regression_model/
│   └── resources/
│       ├── sri_lanka_flood_risk_dataset_25000.csv
│       ├── gauging_stations.csv              # 43 stations with thresholds
│       └── gis_osm_waterways_free_1.shp      # River network shapefile
│
├── raspberry-platform/
│   ├── backend/
│   │   ├── server.js                         # Express entry (:5000)
│   │   ├── config/
│   │   │   ├── constants.js                  # All env/config values
│   │   │   └── database.js                   # SQLite init + migrations
│   │   ├── db/
│   │   │   ├── disaster-schema.sql           # Disaster DB schema
│   │   │   └── pages-schema.sql              # Education DB schema
│   │   ├── services/disaster/
│   │   │   ├── gps-storage.js                # 30-min: GPS → DB
│   │   │   ├── weather-storage.js            # 30-min: Weather → DB
│   │   │   ├── rainfall-storage.js           # 15-min: Rain → DB
│   │   │   ├── dht11-storage.js              # 5-min: DHT11 → DB
│   │   │   ├── water-level-storage.js        # 15-min: Water level → DB
│   │   │   ├── sensor-status-storage.js      # 10-min: Sensor status → DB
│   │   │   └── geocode.js                    # Nominatim reverse geocode
│   │   ├── services/network/
│   │   │   ├── saamp-mqtt.js                 # SAAMP MQTT publisher
│   │   │   └── connectivity.js               # Network monitoring
│   │   ├── services/education/               # Scoring, gating, alerts
│   │   ├── services/resource/                # Registration, distribution
│   │   ├── services/sync/                    # Cloud sync manager
│   │   ├── routes/disaster/disaster.js       # Disaster API routes
│   │   ├── controllers/disaster/disaster.js  # Disaster controllers
│   │   └── python/app.py                     # Flask ML scoring (:5001)
│   ├── frontend/
│   │   └── src/components/
│   │       ├── DashboardPage.jsx             # Main dashboard
│   │       ├── disaster/DisasterMonitorPage.jsx  # Flood monitoring
│   │       ├── resources/DeviceHealthScreen.jsx  # Sensor health
│   │       └── resources/                    # Registration, wristbands, etc.
│   └── prediction-models/
│       └── src/network_predictor.py          # Network QoS classifier
│
├── cloud-platform/
│   ├── backend/
│   │   └── src/
│   │       ├── db/schema.sql                 # Cloud PostgreSQL schema
│   │       └── routes/                       # Cloud API routes
│   ├── frontend/                             # Cloud dashboard (Next.js)
│   └── prediction-models/
│       └── src/
│           ├── population_forecast.py        # 7-day population projection
│           ├── lka_resource_predictor.py     # Daily food/water ration calc
│           ├── lka_intake_model.py           # Child intake prediction
│           └── camp_demand_quantile_model.py # Demand quantiles (P50/P90)
│
└── ARCHITECTURE.md                           # This file
```

---

## 4. Database Schema

### 4.1 Camp Database (`camp.db`) — Raspberry Pi

#### `persons`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| fingerprint_id | TEXT | Unique, not null |
| full_name | TEXT | Not null |
| age | INTEGER | Not null |
| gender | TEXT | M/F |
| family_unit_id | TEXT | Family grouping |
| family_size | INTEGER | Default 1 |
| is_pregnant | INTEGER | 0/1 |
| has_chronic_illness | INTEGER | 0/1 |
| medical_notes | TEXT | |
| pre_registered | INTEGER | 0/1 |
| person_type | TEXT | Default 'refugee' |
| mqtt_client_id | TEXT | MQTT auth |
| mqtt_password | TEXT | MQTT auth |
| is_active | INTEGER | Default 1 |
| registration_date | TEXT | |
| created_at | TEXT | datetime('now') |
| synced | INTEGER | 0/1 |

#### `camp_checkins`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| person_id | INTEGER FK → persons | |
| checkin_time | TEXT | datetime('now') |
| camp_day | INTEGER | Default 1 |
| is_new_arrival | INTEGER | 0/1 |
| synced | INTEGER | |

#### `wristbands`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| person_id | INTEGER FK → persons | |
| barcode | TEXT | Unique |
| qr_identifier | TEXT | CAMP-WB000001 |
| status | TEXT | AVAILABLE/ASSIGNED |
| assigned_at | TEXT | |
| issued_at | TEXT | |
| updated_at | TEXT | |
| is_active | INTEGER | |
| synced | INTEGER | |

#### `wristband_assignments`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| wristband_id | INTEGER FK → wristbands | |
| person_id | INTEGER FK → persons | |
| assigned_at | TEXT | |
| unassigned_at | TEXT | |
| synced | INTEGER | |

#### `distributions`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| wristband_barcode | TEXT FK → wristbands | |
| resource_type | TEXT | Not null |
| quantity | REAL | Not null |
| distributed_at | TEXT | |
| synced | INTEGER | |

#### `resources`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| resource_name | TEXT | Not null |
| category | TEXT | Food/Medicine/Beverage |
| unit | TEXT | portion/bottle/strip |
| total_quantity | REAL | |
| available_quantity | REAL | |
| minimum_threshold | REAL | |
| status | TEXT | AVAILABLE/LOW/DEPLETED |
| created_at | TEXT | |
| updated_at | TEXT | |
| synced | INTEGER | |

#### `resource_usage`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| person_id | INTEGER FK → persons | |
| resource_id | INTEGER FK → resources | |
| meal | TEXT | Breakfast/Lunch/Dinner |
| quantity | REAL | |
| date | TEXT | |
| time | TEXT | |
| recorded_by | TEXT | |
| created_at | TEXT | |
| synced | INTEGER | |

#### `audit_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| actor | TEXT | |
| action | TEXT | Not null |
| person_id | INTEGER | |
| resource_id | INTEGER | |
| wristband_id | INTEGER | |
| quantity | REAL | |
| details | TEXT | |
| created_at | TEXT | |
| synced | INTEGER | |

#### `mqtt_buffer`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| topic | TEXT | |
| payload | TEXT | |
| priority | TEXT | CRITICAL/HIGH/MEDIUM/LOW |
| qos | INTEGER | Default 1 |
| created_at | TEXT | |
| flushed | INTEGER | 0/1 |

#### `sync_pending`
| Column | Type | Notes |
|--------|------|-------|
| sync_id | TEXT PK | |
| entity | TEXT | |
| table_name | TEXT | |
| local_id | TEXT | |
| operation | TEXT | CREATE/UPDATE/DELETE |
| priority | TEXT | |
| payload | TEXT | |
| published | INTEGER | |
| retry_count | INTEGER | |
| max_retries | INTEGER | Default 5 |
| next_retry_at | TEXT | |
| created_at | TEXT | |
| acked_at | TEXT | |

#### `prediction_requests`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| inputs | TEXT | JSON |
| status | TEXT | pending/sent/completed |
| created_at | TEXT | |
| sent_at | TEXT | |
| result | TEXT | JSON |

---

### 4.2 Pages Database (`pages.db`) — Raspberry Pi

#### `pages_children`
| Column | Type | Notes |
|--------|------|-------|
| child_id | TEXT PK | |
| res_id | TEXT | Not null |
| grade | INTEGER | 3 or 4 |
| camp_id | TEXT | |
| zone_id | TEXT | |
| language | TEXT | si/ta/en |
| enrolled_at | TEXT | |
| total_sessions | INTEGER | Default 0 |
| baseline_score | REAL | Default 60.0 |
| consecutive_low | INTEGER | Default 0 |
| sdq_band | TEXT | unknown/normal/borderline/abnormal |
| alert_status | TEXT | none/active/resolved |
| qr_code_data | TEXT | |
| synced | INTEGER | |

#### `pages_sessions`
| Column | Type | Notes |
|--------|------|-------|
| session_id | TEXT PK | |
| child_id | TEXT FK → pages_children | |
| content_session_id | TEXT | |
| session_date | TEXT | |
| session_time | TEXT | |
| condition_label | TEXT | A/B/C |
| composite_score | REAL | |
| task_score | REAL | |
| passive_score | REAL | |
| baseline_score_used | REAL | |
| gate_decision | TEXT | PASS/FAIL_FIRST/FAIL_CONFIRMED/PASS_RECOVERED |
| cognitive_score | REAL | |
| session_complete | INTEGER | |
| anomaly_flagged | INTEGER | |
| z_score | REAL | |
| if_score | REAL | |
| alert_triggered | INTEGER | |
| synced | INTEGER | |

#### `pages_behavioral_signals`
| Column | Type | Notes |
|--------|------|-------|
| signal_id | TEXT PK | |
| session_id | TEXT FK | |
| child_id | TEXT FK | |
| accuracy_rate | REAL | 0.0–1.0 |
| false_tap_rate | REAL | 0.0–1.0 |
| avg_reaction_time | REAL | |
| reaction_variance | REAL | |
| idle_time_ratio | REAL | 0.0–1.0 |
| rapid_click_count | INTEGER | |
| time_to_first_ms | REAL | |
| completion_ratio | REAL | 0.0–1.0 |
| synced | INTEGER | |

#### `pages_gate_decisions`
| Column | Type | Notes |
|--------|------|-------|
| decision_id | TEXT PK | |
| session_id | TEXT FK | |
| child_id | TEXT FK | |
| attempt_number | INTEGER | 1 or 2 |
| composite_score | REAL | |
| decision | TEXT | |
| decided_at | TEXT | |
| synced | INTEGER | |

#### `pages_alerts`
| Column | Type | Notes |
|--------|------|-------|
| alert_id | TEXT PK | |
| child_id | TEXT FK | |
| camp_id | TEXT | |
| res_id | TEXT | |
| alert_type | TEXT | 3_consecutive_flagged / 3_of_5_flagged |
| trigger_detail | TEXT | |
| triggered_at | TEXT | |
| status | TEXT | pending/resolved |
| resolved_at | TEXT | |
| resolved_notes | TEXT | |
| synced | INTEGER | |

#### `content_sessions`
| Column | Type | Notes |
|--------|------|-------|
| content_session_id | TEXT PK | |
| session_label | TEXT | |
| grade_level | INTEGER | 3 or 4 |
| zeo_approved | INTEGER | |
| approved_date | TEXT | |

#### `content_tasks`
| Column | Type | Notes |
|--------|------|-------|
| task_id | TEXT PK | |
| content_session_id | TEXT FK | |
| task_order | INTEGER | 1–10 |
| subject | TEXT | |
| task_type | TEXT | mcq |
| question_text | TEXT | |
| option_a/b/c | TEXT | |
| correct_answer | TEXT | a/b/c |
| grade_level | INTEGER | |

#### `pages_content_responses`
| Column | Type | Notes |
|--------|------|-------|
| response_id | TEXT PK | |
| session_id | TEXT FK | |
| child_id | TEXT FK | |
| task_id | TEXT | |
| selected_answer | TEXT | |
| is_correct | INTEGER | 0/1 |
| time_taken_ms | INTEGER | |
| responded_at | TEXT | |
| synced | INTEGER | |

---

### 4.3 Disaster Database (`disaster.db`) — Raspberry Pi

#### `gps_readings`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| device_id | TEXT | |
| latitude | REAL | Not null |
| longitude | REAL | Not null |
| altitude | REAL | |
| accuracy | REAL | |
| source | TEXT | Default 'GPS_SENSOR' |
| location_name | TEXT | Village/town from geocode |
| location_district | TEXT | District from geocode |
| recorded_at | TEXT | |
| synced | INTEGER | |

#### `rainfall_readings`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| device_id | TEXT | |
| rain_analog | INTEGER | Raw analog value |
| rain_digital | INTEGER | 0/1 |
| rain_status | TEXT | RAIN_DETECTED/NO_RAIN |
| wetness_level | TEXT | DRY/LIGHT/MODERATE/HEAVY |
| wetness_value | INTEGER | 0–3 |
| latitude | REAL | |
| longitude | REAL | |
| recorded_at | TEXT | |
| synced | INTEGER | |

#### `HumidityTemp_readings`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| device_id | TEXT | |
| temperature | REAL | Celsius |
| humidity | REAL | Percentage |
| latitude | REAL | |
| longitude | REAL | |
| recorded_at | TEXT | |
| synced | INTEGER | |

#### `water_level_readings`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| device_id | TEXT | |
| station_id | TEXT | Gauging station ID |
| water_level | REAL | Meters |
| unit | TEXT | 'm' |
| river_name | TEXT | |
| station_name | TEXT | |
| distance_km | REAL | Distance from GPS |
| latitude | REAL | Camp GPS |
| longitude | REAL | Camp GPS |
| alert_level | REAL | Alert threshold (m) |
| minor_flood_level | REAL | Minor flood threshold (m) |
| major_flood_level | REAL | Major flood threshold (m) |
| rainfall | REAL | From ArcGIS gauge |
| gauge_latitude | REAL | Station coordinates |
| gauge_longitude | REAL | Station coordinates |
| source | TEXT | LIVE_PAYLOAD |
| updated_at | TEXT | ArcGIS EditDate |
| recorded_at | TEXT | |
| synced | INTEGER | |

#### `sensor_status_readings`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| device_id | TEXT | |
| gps_connected | INTEGER | 1/0 |
| temperature_connected | INTEGER | 1/0 |
| humidity_connected | INTEGER | 1/0 |
| rainfall_connected | INTEGER | 1/0 |
| gateway_status | TEXT | connected/disconnected |
| recorded_at | TEXT | |
| synced | INTEGER | |

#### `weather_data`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| device_id | TEXT | |
| latitude | REAL | |
| longitude | REAL | |
| temperature | REAL | |
| humidity | REAL | |
| precipitation | REAL | |
| rainfall | REAL | |
| wind_speed | REAL | |
| wind_direction | REAL | |
| weather_code | INTEGER | WMO code |
| condition | TEXT | Text description |
| forecast_data | TEXT | JSON blob |
| forecast_time | TEXT | |
| source | TEXT | |
| fetched_at | TEXT | |
| created_at | TEXT | |
| synced | INTEGER | |

#### `disaster_events`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| event_type | TEXT | |
| status | TEXT | ACTIVE/RESOLVED |
| severity | TEXT | |
| location_lat | REAL | |
| location_lng | REAL | |
| started_at | TEXT | |
| ended_at | TEXT | |
| created_at | TEXT | |
| updated_at | TEXT | |
| synced | INTEGER | |

#### `flood_predictions`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| prediction_id | TEXT | Unique |
| latitude | REAL | |
| longitude | REAL | |
| rainfall | REAL | |
| elevation | REAL | |
| river_distance | REAL | |
| flood_probability | REAL | 0.0–1.0 |
| flood_category | TEXT | High/Medium/Low |
| forecast_hours | INTEGER | |
| model_version | TEXT | |
| predicted_at | TEXT | |
| synced | INTEGER | |

#### `disaster_alerts`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| alert_type | TEXT | |
| severity | TEXT | |
| title | TEXT | |
| message | TEXT | |
| latitude | REAL | |
| longitude | REAL | |
| prediction_id | TEXT | |
| status | TEXT | ACTIVE/ACKNOWLEDGED |
| created_at | TEXT | |
| acknowledged_at | TEXT | |
| synced | INTEGER | |

#### `hydrospatial_data`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| latitude | REAL | |
| longitude | REAL | |
| elevation | REAL | |
| river_distance | REAL | |
| nearest_station_id | TEXT | |
| river_name | TEXT | |
| source | TEXT | |
| created_at | TEXT | |
| synced | INTEGER | |

#### `disaster_sync_queue` / `disaster_sync_log`
Standard sync queue/log tables for MQTT-based cloud sync.

---

### 4.4 Cloud PostgreSQL — Mirrors Edge Tables + Cloud-Only Tables

The cloud schema mirrors ~20 edge tables (persons, wristbands, distributions, etc.) and adds cloud-only tables: `CAMPS`, `camp_persons`, `camp_daily_snapshots`, `sync_log`, `sensor_readings`, `environmental_data`, `children`, `sessions`, `alerts`.

---

## 5. API Endpoints

### 5.1 Edge Gateway (FastAPI :8000)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/api/device-status` | All sensor status (GPS, DHT11, Rain) |
| GET | `/api/gps` | Latest cached GPS data |
| GET | `/api/dht11` | Latest cached DHT11 data |
| GET | `/api/rainfall` | Latest cached rainfall data |
| GET | `/hydrospatial/predict?lat=&lon=&alt=` | Flood prediction (XGBoost) |
| GET | `/hydrospatial/live-payload?lat=&lon=&alt=` | Full live payload (river + station + gauge + weather) |
| GET | `/hydrospatial/nearest-river-gauging-station?lat=&lon=` | Nearest river + station |
| GET | `/hydrospatial/weather?lat=&lon=` | Weather forecast (Open-Meteo) |

### 5.2 Raspberry Pi Backend (Express :5000)

#### Disaster Routes (`/api/disaster/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/latest-gps` | Latest GPS from DB |
| GET | `/weather/latest` | Latest weather from DB |
| GET | `/weather/status` | Weather scheduler status |
| GET | `/rainfall/latest` | Latest rainfall from DB |
| GET | `/rainfall/status` | Rainfall scheduler status |
| POST | `/rainfall/save` | Manual rainfall save trigger |
| GET | `/dht11/latest` | Latest DHT11 from DB |
| GET | `/dht11/status` | DHT11 scheduler status |
| POST | `/dht11/save` | Manual DHT11 save trigger |
| GET | `/water-level/latest` | Latest water level from DB |
| GET | `/water-level/history?limit=20` | Water level chart history |
| GET | `/water-level/status` | Water level scheduler status |
| POST | `/water-level/save` | Manual water level save trigger |
| GET | `/sensor-status/latest` | Latest sensor connectivity |
| GET | `/sensor-status/status` | Sensor status scheduler status |
| POST | `/sensor-status/save` | Manual sensor status save |
| GET | `/device-status` | Proxied Edge Gateway device status |
| GET | `/live-payload?lat=&lon=&alt=` | Proxied Edge Gateway live-payload |
| GET | `/predict?lat=&lon=&alt=` | Proxied Edge Gateway prediction |
| GET | `/camps` | All camps |
| GET | `/camps/:id` | Camp by ID |
| GET | `/overview` | Disaster overview |
| GET | `/camp-identity` | Dynamic camp identity |

#### Resource Routes (`/api/`)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/register` | List/create persons |
| POST | `/checkin` | Check in person |
| GET/POST | `/wristbands` | List/create wristbands |
| POST | `/wristbands/:id/assign` | Assign wristband |
| POST | `/distribute` | Distribute resources |
| GET | `/stats/overview` | Camp statistics |
| POST | `/fingerprint/enroll` | Start fingerprint enrollment |
| GET | `/fingerprint/events` | SSE stream for fingerprint events |

#### Education Routes (`/api/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/child/list` | List children |
| GET | `/child/:id/education` | Child education data |
| POST | `/session/start` | Start cognitive session |
| POST | `/session/complete` | Complete session |
| POST | `/session/score` | Submit score |

### 5.3 Cloud Backend (Express)

Mirrors edge resource/education routes + cloud-only admin/analytics routes.

---

## 6. Scheduled Data Collection (Raspberry Pi Backend)

| Service | Interval | Source | Destination |
|---------|----------|--------|-------------|
| `gps-storage.js` | 30 min | Edge Gateway `/api/gps` | `gps_readings` |
| `weather-storage.js` | 30 min | Edge Gateway `/hydrospatial/weather` | `weather_data` |
| `rainfall-storage.js` | 15 min | Edge Gateway `/api/rainfall` | `rainfall_readings` |
| `dht11-storage.js` | 5 min | Edge Gateway `/api/dht11` | `HumidityTemp_readings` |
| `water-level-storage.js` | 15 min | Edge Gateway `/hydrospatial/live-payload` | `water_level_readings` |
| `sensor-status-storage.js` | 10 min | Edge Gateway `/api/device-status` | `sensor_status_readings` |

**Data Flow Principle:** External APIs → Edge Gateway → Local DB → Frontend. The frontend never calls external APIs directly for sensor/disaster data.

---

## 7. Mock Data Inventory

### Raspberry Platform Frontend — Active Mock Data

| File | Variable | Status | Description |
|------|----------|--------|-------------|
| `DashboardPage.jsx` | `MOCK_RESOURCE_USAGE` | **ACTIVE** | Food/Water/Medical/Shelter usage bars — rendered in dashboard |
| `DashboardPage.jsx` | `MOCK_POPULATION` | **ACTIVE** | Population donut chart (Adults/Children/Elderly/Pregnant) |
| `DashboardPage.jsx` | `MOCK_DISASTER_INSIGHT` | **Dead code** | Declared but never rendered — replaced by API data |
| `DashboardPage.jsx` | `MOCK_SYNC_TIMELINE` | **Dead code** | Declared but never rendered |
| `DeviceHealthScreen.jsx` | `mockData` (fingerprint) | **ACTIVE** | Fingerprint card shows mock enrolled/scan data with `(Mock)` label |
| `AuthContext.jsx` | `HARDCODED_CODE = '123456'` | **ACTIVE** | Single hardcoded PIN for authentication — security concern |

### Cloud Platform Frontend

No mock data found in cloud frontend. All data is API-driven.

### Edge Gateway

No mock data. All sensor data is live from ESP32 serial.

---

## 8. Internet-Dependent API Calls

### Raspberry Pi Backend → Edge Gateway (Local Network)

These calls go over local network to the Edge Gateway. They work without internet only if Edge Gateway is on the same network:

| Service | Endpoint | Interval |
|---------|----------|----------|
| GPS storage | `http://127.0.0.1:8000/api/gps` | 30 min |
| Weather storage | `http://127.0.0.1:8000/hydrospatial/weather` | 30 min |
| Rainfall storage | `http://127.0.0.1:8000/api/rainfall` | 15 min |
| DHT11 storage | `http://127.0.0.1:8000/api/dht11` | 5 min |
| Water level storage | `http://127.0.0.1:8000/hydrospatial/live-payload` | 15 min |
| Sensor status | `http://127.0.0.1:8000/api/device-status` | 10 min |

### Edge Gateway → External APIs (Require Internet)

| API | URL | Purpose | Frequency |
|-----|-----|---------|-----------|
| Nominatim | `https://nominatim.openstreetmap.org/reverse` | GPS → location name | On each GPS fix (cached) |
| Open-Meteo | `https://api.open-meteo.com/v1/forecast` | Weather forecast | Every 30 min |
| ArcGIS | `https://services3.arcgis.com/.../gauges_2_view/FeatureServer/0/query` | Live water level | Every 15 min |
| Overpass | `https://overpass-api.de/api/interpreter` | Nearest river/station | On water level fetch (cached 1hr) |
| Open-Elevation | `https://api.open-elevation.com/api/v1/lookup` | Elevation fallback | On demand |

### Frontend → External APIs (CRITICAL: Should Not Happen)

| File | URL | Issue |
|------|-----|-------|
| `DeviceHealthScreen.jsx:168` | `https://nominatim.openstreetmap.org/reverse` | Direct browser call — bypasses backend caching, exposes to rate limits, fails without internet |

**Recommendation:** Move this to a Pi backend proxy endpoint (`/api/disaster/reverse-geocode`).

### Raspberry Pi → MQTT Broker (Require Internet)

| Service | Broker | Port |
|---------|--------|------|
| SAAMP MQTT | `emqxsl.com` | 8883 (TLS) |

### Raspberry Pi → Cloud Sync (Require Internet)

| Service | Target |
|---------|--------|
| sync-manager.js | PostgreSQL on AWS RDS |

---

## 9. Duplicate / Redundant API Calls

### HIGH Priority

| Issue | Files | Endpoint | Impact |
|-------|-------|----------|--------|
| **Double session complete** | `CognitiveSession.jsx:344` + `cognitive/page.js:73` | `POST /api/session/complete` | Session completion submitted twice per child |
| **device-status polled from 2 places** | `Navbar.jsx:101` (10s) + `DeviceHealthScreen.jsx:392` (3s) | `GET /api/disaster/device-status` | Redundant load when on Device Health page |

### MEDIUM Priority

| Issue | Files | Endpoint |
|-------|-------|----------|
| **Prediction code duplicated** | `WristbandScanScreen.jsx` PredictionPanel + `PredictionScreen.jsx` | `/api/prediction/inputs`, `/results`, `/forecast` |
| **network/state vs network/status** | `PredictionScreen.jsx:174` vs `NetworkScreen.jsx:119` | Similar data, different endpoints |

### LOW Priority

| Issue | Files | Endpoint |
|-------|-------|----------|
| **Register fetched from 2 screens** | `RegistrationScreen.jsx` + `WristbandsScreen.jsx` | `GET /api/register` |
| **fingerprint/status from hook** | `useFingerprintDevice.js` used by 2 screens | `GET /api/fingerprint/status` |

---

## 10. Prediction Models

### 10.1 Flood Prediction (Edge Gateway)

**Location:** `edge-gateway/prediction-models/`

All models inherit from `BaseFloodModel` and share:
- **Training data:** `sri_lanka_flood_risk_dataset_25000.csv` (25,000 records)
- **Features (5):** `rainfall_7d_mm`, `longitude`, `latitude`, `elevation_m`, `distance_to_river_m`
- **Runtime input:** `gauging_station_current_water_level_m` (adjusts probability)
- **Output:** `flood_possibility` (Likely/Unlikely), `category` (High/Medium/Low), `probability` (0–1)

| Model | Algorithm | Accuracy | F1 | ROC-AUC | Status |
|-------|-----------|----------|----|---------|--------|
| **XGBoost** | XGBClassifier (300 trees, depth=6) | 82.4% | 0.503 | **0.927** | ★ Production |
| Random Forest | RandomForestClassifier (300 trees) | 80.0% | 0.447 | 0.886 | Backup |
| Decision Tree | DecisionTreeClassifier (depth=8) | 69.7% | 0.354 | 0.840 | Baseline |
| Logistic Regression | LogisticRegression | 70.9% | 0.316 | 0.776 | Baseline |

**Probability Adjustment Logic:**
```python
# Water level correction
correction = clip((water_level - 2.0) * 0.05, -0.12, 0.25)
adjusted_prob = clip(base_prob + correction, 0.0, 1.0)

# Forecast modifier (if using forecast data)
forecast_prob = clip(adjusted_prob * 1.10 + 0.03, 0.0, 1.0)
```

**Category Thresholds:**
- Probability ≥ 0.70 → **High** risk
- Probability ≥ 0.40 → **Medium** risk
- Probability < 0.40 → **Low** risk

**How to use properly:**
1. Call `GET /hydrospatial/predict?lat=&lon=&alt=` from Edge Gateway
2. The endpoint automatically: finds nearest river → finds upstream gauging station → fetches live gauge data → runs XGBoost prediction
3. Returns prediction + source data + inputs used
4. Frontend should display `category` and `probability` from the response

### 10.2 Network QoS Prediction (Raspberry Pi)

**Location:** `raspberry-platform/prediction-models/`

| Model | Algorithm | Classes |
|-------|-----------|---------|
| Network State Classifier | RandomForestClassifier (200 trees) | STABLE / DEGRADED / CRITICAL |

**Features (18):** RTT, packet loss, jitter, queue depth, throughput, bandwidth, time-of-day encodings, etc.

**How it works:** `network_monitor_service.py` runs every 30 seconds, reads network metrics, predicts state, and pushes to `POST /api/network/state`. The SAAMP MQTT system uses this state to adapt message priority/batching.

### 10.3 Resource Prediction (Cloud Platform)

**Location:** `cloud-platform/prediction-models/`

| Model | Algorithm | Purpose |
|-------|-----------|---------|
| Population Forecast | Theil-Sen + Gardner-McKenzie damping | 7-day camp population projection |
| LKA Resource Predictor | Deterministic rate table | Daily food (kg) and water (L) per cohort |
| Child Intake Model | RidgeCV regression | Per-child food consumption prediction |
| Camp Demand Quantile | GradientBoosting (P50/P90) | Uncertainty-aware food demand quantiles |

**Key rates (LKA Resource Predictor):**
- Child (6-14): 1.76 kg/day
- Adult: 1.6 kg/day
- Elderly (60-74): 1.71 kg/day
- Elderly (75+): 1.37 kg/day
- Pregnant topup: +0.6 kg/day
- Water: 3.0 L/person/day

---

## 11. Performance Suggestions

### Backend

1. **Use SQLite WAL mode** — Already enabled. Ensures concurrent reads during writes.
2. **Add indexes on foreign keys** — Already done for most tables. Verify `distributions.wristband_barcode` and `resource_usage.person_id` have indexes.
3. **Batch MQTT messages** — SAAMP already batches by network state. Ensure `mqtt_buffer` table is flushed periodically (not per-message).
4. **Cache Edge Gateway responses** — The water-level and weather services already cache in-memory. Consider adding HTTP cache headers for frontend.

### Frontend

5. **Reduce polling frequency** — `DeviceHealthScreen` polls every 3s which is aggressive. Consider 10s or using WebSocket/SSE for real-time updates.
6. **Share device-status data** — Navbar and DeviceHealthScreen both poll `/api/disaster/device-status`. Use React Context or a shared store to avoid duplicate calls.
7. **Lazy-load disaster page** — The DisasterMonitorPage fetches 4 endpoints on mount. Consider lazy loading the water-level chart data.
8. **Memoize chart components** — `LevelGauge` and `LevelHistoryChart` re-render on every state change. Wrap in `React.memo`.

### Edge Gateway

9. **Cache Overpass results** — River/station lookups are cached for 1 hour. This is good. Consider extending to 6 hours for river data (rarely changes).
10. **Batch NMEA processing** — The serial reader processes 30 lines per batch. This is efficient. Ensure `LINES_PER_BATCH` matches the sensor output rate.

### Database

11. **Archive old readings** — Add a retention policy (e.g., keep last 30 days of sensor readings, archive to cold storage).
12. **Vacuum periodically** — SQLite databases grow over time. Schedule `VACUUM` monthly.

---

## 12. Architecture Suggestions

### Critical

1. **Remove hardcoded auth** — `AuthContext.jsx` uses `HARDCODED_CODE = '123456'`. Implement proper JWT auth with the backend.
2. **Move Nominatim call to backend** — `DeviceHealthScreen.jsx` calls Nominatim directly. Create `/api/disaster/reverse-geocode` endpoint on Pi backend.
3. **Fix double session complete** — `CognitiveSession.jsx` and `cognitive/page.js` both call `/api/session/complete`. Remove one.
4. **Clean up dead mock data** — Remove `MOCK_DISASTER_INSIGHT` and `MOCK_SYNC_TIMELINE` from `DashboardPage.jsx`.

### Important

5. **Connect MOCK_RESOURCE_USAGE to API** — Dashboard shows fake resource usage. Create `/api/resources/usage-summary` endpoint.
6. **Connect MOCK_POPULATION to API** — Dashboard shows fake population chart. Use `GET /api/stats/overview` data which already has population counts.
7. **Connect fingerprint card to API** — `DeviceHealthScreen.jsx` shows mock fingerprint data. Create `/api/fingerprint/stats` endpoint.
8. **Extract PredictionPanel** — The prediction UI is duplicated in `WristbandScanScreen.jsx` and `PredictionScreen.jsx`. Extract to a shared component.

### Nice to Have

9. **Add WebSocket for real-time sensor data** — Instead of polling, push sensor updates via WebSocket (Socket.IO is already installed).
10. **Implement data retention policies** — Auto-archive old sensor readings.
11. **Add health check dashboard** — A unified page showing all scheduler statuses and last save times.
12. **Standardize API response format** — Some endpoints return `{ available: true, ...data }` while others return raw data. Standardize to `{ success: true, data: {...} }`.

---

## 13. External Services

| Service | Purpose | Auth | Fallback |
|---------|---------|------|----------|
| EMQX Cloud MQTT | Cloud sync | TLS certificate | Offline buffer in `mqtt_buffer` |
| AWS RDS PostgreSQL | Cloud database | Password | Local SQLite continues |
| Nominatim (OSM) | Reverse geocoding | User-Agent header | Cached results |
| Open-Meteo | Weather forecast | None | Last cached forecast |
| ArcGIS | Live water level | None | Last cached reading |
| Overpass (OSM) | River/station lookup | None | Cached 1 hour |
| Open-Elevation | Elevation data | None | Local DEM shapefile |
