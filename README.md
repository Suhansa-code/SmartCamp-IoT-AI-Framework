# 🌍 Smart Disaster Relief Camp Box (SDRC-Box)

<div align="center">

![IoT](https://img.shields.io/badge/IoT-ESP32-blue?style=for-the-badge)
![AI](https://img.shields.io/badge/AI-TensorFlow_Lite-orange?style=for-the-badge)
![MQTT](https://img.shields.io/badge/MQTT-EMQX-orange?style=for-the-badge&logo=emqx)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react)
![Edge](https://img.shields.io/badge/Edge-Raspberry_Pi-red?style=for-the-badge)

</div>

---

## 1. Project Vision

The **SDRC-Box** is an AI-powered disaster response ecosystem combining:

- 🌊 Flood prediction (Edge AI)
- 📡 MQTT messaging via **EMQX Broker**
- 📦 Smart resource management
- 🧠 Offline education + psychology support (PAGES)
- ☁️ Cloud analytics dashboard

It ensures **continuous operation even without internet** (offline-first design).

---

## 2. System Architecture

A 4-layer IoT-AI framework for disaster relief camp management:

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

### Smart System Workflow

```mermaid
flowchart LR

A[📟 ESP32 Sensors]
B[📡 EMQX MQTT Broker]

A --> B

B --> C[🧠 Raspberry Pi Edge Gateway]

C --> D[🌊 Flood Prediction AI]
C --> E[📦 Resource Management]
C --> F[🧠 Psychology Module]

C --> S[📡 SAAMP Engine]
S --> S1[🔴 Priority Classification]
S --> S2[📶 Predictive QoS]
S --> S3[💾 Offline Buffering]

D --> G[🚨 Alert System]
E --> G
F --> G
S --> G

B <--> X[☁️ Cloud MQTT Bridge]
X --> Y[🌐 Cloud Server]

Y --> Z[📊 Admin Dashboard]
Y --> Z1[🗄 Database]
```

### Data Flow Principle

`External APIs → Edge Gateway → Local DB → Frontend`

The frontend never calls external APIs directly for sensor/disaster data.

---

## 3. Tech Stack

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

### Ports Summary

| Component | Port | Protocol |
|-----------|------|----------|
| Edge Gateway FastAPI | **8000** | HTTP |
| RPi Backend (Express) | **5000** | HTTP |
| Cloud Backend (Express) | **3001** | HTTP |
| Cloud Frontend (Next.js) | **3000** | HTTP |
| Flask ML Scoring | **5001** | HTTP |
| EMQX MQTTS | **8883** | MQTTS |
| EMQX API | **8443** | HTTPS |

---

## 4. Repository Structure

```
SmartCamp-IoT-AI-Framework/
│
├── sensor-node/                 # [ESP32] GPS + DHT11 + Rain firmware
│   └── Sensor_Bridge/           # Serial/UART bridge to Edge Gateway
│
├── edge-gateway/                # [Intel NUC] Edge processing
│   ├── scripts/                 # FastAPI (:8000), GPS/DHT11/Rain, hydrospatial, DEM
│   ├── prediction-models/       # Flood ML (XGBoost ★ production)
│   └── resources/               # Flood dataset, gauging stations, GIS shapefile
│
├── raspberry-platform/          # [RPi 5] Camp local server
│   ├── backend/                 # Express (:5000) + Flask ML (:5001) + SQLite × 3
│   ├── frontend/                # React 18 + Vite + Tailwind camp UI
│   └── prediction-models/       # Network QoS classifier
│
├── cloud-platform/              # [AWS VM] Cloud services
│   ├── backend/                 # Express (:3001) + PostgreSQL + tests
│   ├── frontend/                # Next.js admin dashboard (:3000)
│   ├── ml-service/              # Flask PAGES ML scoring (:5001)
│   └── prediction-models/       # Resource/network ML + Jupyter notebooks
│
├── .github/workflows/           # Auto PR from *-dev → main
└── README.md
```

---

## 5. Core Modules

| Module | Description |
|---|---|
| 🌊 Flood Prediction | AI-based environmental forecasting (Edge XGBoost) |
| 📦 Resource Management | QR wristband + real-time inventory system |
| 📡 MQTT System | EMQX broker message handling |
| 🧠 SAAMP | Adaptive QoS + priority routing |
| 🌐 Cloud Bridge | Real-time dashboard sync |
| 📱 React UI | Admin control panel |
| 📚 PAGES | Psycho-attentional gated educational system |

### Key Research Contributions

1. **SAAMP** — Semantic-Aware Adaptive Message Prioritization
   - SACS: Source-Action Semantic Classification
   - Predictive QoS adjustment based on network state
   - Priority-ordered offline buffering
2. **PAGES** — Psycho-Attentional Gated Educational System
   - Go/No-Go cognitive assessment games
   - Z-score + Isolation Forest anomaly detection
   - Gated progression (PASS/FAIL_FIRST decision)
3. **Integrated Disaster Response Platform**
   - End-to-end: sensor → edge AI → camp management → cloud analytics
   - Offline-first design for disaster scenarios
   - Resource forecasting driven by real-time camp demographics

---

## 6. Cloud Sync (SQLite → MQTT → PostgreSQL)

Local SQLite → MQTT → Cloud PostgreSQL synchronization for offline-first camps.

```
Raspberry Pi (Offline-first)          EMQX Broker          Cloud (PostgreSQL)
┌──────────────────────┐              ┌────────┐           ┌──────────────────────┐
│  Local SQLite         │──publish──▶ │  MQTT  │──receive──▶│  syncReceiver        │
│  camp.db / pages.db   │            │  :8883 │           │  sync.postgres.repo  │
│  sync_pending         │◀──ACK───── │  TLS   │◀─ACK─────│  sync_log            │
│  sync-manager         │            │        │           │                      │
└──────────────────────┘              └────────┘           └──────────────────────┘
```

### MQTT Topics

| Topic | Direction | Purpose |
|---|---|---|
| `smartcamp/sync/<entity>` | RPi → Cloud | Per-record sync messages |
| `smartcamp/sync/ack/<device_id>` | Cloud → RPi | ACK after persistence |

Other topics: `smartcamp/registration/`, `checkin/`, `distribution/`, `wristband/`, `flood/`, `network/`, `prediction/`

Entities: `person`, `checkin`, `wristband`, `distribution`, `resource`, `resource_usage`, `audit_log`, `child`, `session`, `behavioral_signal`, `gate_decision`, `alert`, `content_response`

### Data Flow

1. **Service call** → business logic inserts/updates a row in SQLite
2. **enqueueSync()** → writes to `sync_pending` (synchronous, no cloud dependency)
3. **sync-manager cycle** → classifies priority, publishes per-record via SAAMP MQTT
4. **Cloud receives** → `syncReceiver` routes to entity handler → idempotent upsert → writes `sync_log`
5. **Cloud ACKs** → publishes to `smartcamp/sync/ack/<device_id>`
6. **RPi receives ACK** → marks `synced=1` + deletes from `sync_pending`

### Priority Classification (CRITICAL → HIGH → MEDIUM → LOW)

| Level | Examples |
|---|---|
| CRITICAL | Pregnant person, chronic illness, medicine distribution, consecutive alerts |
| HIGH | Registration, check-in, wristband, water/food, low stock, FAIL_CONFIRMED |
| MEDIUM | Normal resources, FAIL_FIRST, resolved alerts |
| LOW | Audit logs, behavioral signals, content responses, normal sessions |

### Offline Resilience

- **enqueueSync()** never throws — always succeeds locally
- **Adaptive sync interval** — `STABLE` → 5s, `DEGRADED` → 15s, `CRITICAL` → 60s
- **SAAMP buffering** — non-CRITICAL messages buffered when network is CRITICAL
- **Exponential backoff** — 1min → 2min → 4min → 8min → 16min → 30min (max 10 retries)
- **Restart-safe** — `sync_pending` persists in SQLite, survives power loss
- **Idempotent** — cloud uses ON CONFLICT upserts + `sync_log` to prevent duplicates

---

## 7. Databases

### Edge — Raspberry Pi (SQLite × 3)

| Database | Purpose | Key Tables |
|----------|---------|------------|
| `camp.db` | Camp operations | `persons`, `camp_checkins`, `wristbands`, `wristband_assignments`, `distributions`, `resources`, `resource_usage`, `audit_logs`, `mqtt_buffer`, `sync_pending`, `prediction_requests` |
| `pages.db` | Education system | `pages_children`, `pages_sessions`, `pages_behavioral_signals`, `pages_gate_decisions`, `pages_alerts`, `content_sessions`, `content_tasks`, `pages_content_responses` |
| `disaster.db` | Sensor/disaster data | `gps_readings`, `rainfall_readings`, `HumidityTemp_readings`, `water_level_readings`, `sensor_status_readings`, `weather_data`, `disaster_events`, `flood_predictions`, `disaster_alerts`, `hydrospatial_data`, `disaster_sync_queue` |

### Cloud — PostgreSQL

Mirrors ~20 edge tables (persons, wristbands, distributions, etc.) plus cloud-only tables: `CAMPS`, `camp_persons`, `camp_daily_snapshots`, `sync_log`, `sensor_readings`, `environmental_data`, `children`, `sessions`, `alerts`.

### Scheduled Data Collection (RPi Backend)

| Service | Interval | Source | Destination |
|---------|----------|--------|-------------|
| `gps-storage.js` | 30 min | Edge `/api/gps` | `gps_readings` |
| `weather-storage.js` | 30 min | Edge `/hydrospatial/weather` | `weather_data` |
| `rainfall-storage.js` | 15 min | Edge `/api/rainfall` | `rainfall_readings` |
| `dht11-storage.js` | 5 min | Edge `/api/dht11` | `HumidityTemp_readings` |
| `water-level-storage.js` | 15 min | Edge `/hydrospatial/live-payload` | `water_level_readings` |
| `sensor-status-storage.js` | 10 min | Edge `/api/device-status` | `sensor_status_readings` |

---

## 8. API Endpoints

### Edge Gateway (FastAPI :8000)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/device-status` | All sensor status (GPS, DHT11, Rain) |
| GET | `/api/gps` | Latest cached GPS data |
| GET | `/api/dht11` | Latest cached DHT11 data |
| GET | `/api/rainfall` | Latest cached rainfall data |
| GET | `/hydrospatial/predict?lat=&lon=&alt=` | Flood prediction (XGBoost) |
| GET | `/hydrospatial/live-payload?lat=&lon=&alt=` | River + station + gauge + weather payload |
| GET | `/hydrospatial/weather?lat=&lon=` | Weather forecast (Open-Meteo) |

### Raspberry Pi Backend (Express :5000)

| Group | Prefix | Key Endpoints |
|-------|--------|---------------|
| Disaster | `/api/disaster/` | `/latest-gps`, `/weather/latest`, `/rainfall/latest`, `/dht11/latest`, `/water-level/latest`, `/sensor-status/latest`, `/device-status`, `/live-payload`, `/predict`, `/camps`, `/overview` |
| Resource | `/api/` | `/register`, `/checkin`, `/wristbands`, `/distribute`, `/stats/overview`, `/fingerprint/enroll` |
| Education | `/api/` | `/child/list`, `/child/:id/education`, `/session/start`, `/session/complete`, `/session/score` |

### Cloud Backend (Express :3001)

Mirrors edge resource/education routes + cloud-only admin/analytics routes.

### Internet-Dependent External APIs

| API | Purpose | Frequency |
|-----|---------|-----------|
| Nominatim (OSM) | GPS → location name | On GPS fix (cached) |
| Open-Meteo | Weather forecast | Every 30 min |
| ArcGIS | Live water level | Every 15 min |
| Overpass (OSM) | Nearest river/station | Cached 1 hour |
| Open-Elevation | Elevation fallback | On demand |
| EMQX (`emqxsl.com:8883`) | SAAMP MQTT + cloud sync | Continuous |

---

## 9. Prediction Models

### Flood Prediction (Edge Gateway) — `edge-gateway/prediction-models/`

Training data: `sri_lanka_flood_risk_dataset_25000.csv` (25,000 records)
Features (5): `rainfall_7d_mm`, `longitude`, `latitude`, `elevation_m`, `distance_to_river_m`

| Model | Accuracy | F1 | ROC-AUC | Status |
|-------|----------|----|---------|--------|
| **XGBoost** (300 trees, depth=6) | 82.4% | 0.503 | **0.927** | ★ Production |
| Random Forest (300 trees) | 80.0% | 0.447 | 0.886 | Backup |
| Decision Tree (depth=8) | 69.7% | 0.354 | 0.840 | Baseline |
| Logistic Regression | 70.9% | 0.316 | 0.776 | Baseline |

**Category thresholds:** ≥ 0.70 → High · ≥ 0.40 → Medium · < 0.40 → Low
Live water level from the nearest upstream gauging station adjusts the probability at runtime.

### Network QoS Prediction (Raspberry Pi)

RandomForestClassifier (200 trees) → `STABLE / DEGRADED / CRITICAL` from 18 features (RTT, packet loss, jitter, queue depth, etc.). Runs every 30s; SAAMP uses the state to adapt message priority/QoS.

### Resource Prediction (Cloud)

| Model | Algorithm | Purpose |
|-------|-----------|---------|
| Population Forecast | Theil-Sen + Gardner-McKenzie damping | 7-day camp population projection |
| LKA Resource Predictor | Deterministic rate table | Daily food (kg) / water (L) per cohort |
| Child Intake Model | RidgeCV regression | Per-child food consumption |
| Camp Demand Quantile | GradientBoosting (P50/P90) | Uncertainty-aware food demand |

Key rates: Child (6–14) 1.76 kg/day · Adult 1.6 kg/day · Elderly (60–74) 1.71 kg/day · Elderly (75+) 1.37 kg/day · Pregnant +0.6 kg/day · Water 3.0 L/person/day

### PAGES Anomaly Detection

| Technique | Purpose | Minimum Sessions |
|-----------|---------|-----------------|
| Z-score | Deviation from baseline performance | 3 |
| Isolation Forest | Complex anomaly patterns | 8 |

---

## 10. Testing

Two independent test suites — RPi platform and Cloud platform.

### Quick Commands

```bash
# Raspberry Pi Platform (Vitest)
cd raspberry-platform/backend
npm test                # all tests
npm run test:watch      # watch mode
npm run test:coverage   # coverage report

# Cloud Platform (node:test)
cd cloud-platform/backend
npm test                # all tests
```

### Coverage

| RPi Platform (250 tests) | Cloud Platform (41 tests) |
|---|---|
| Config (camp-id): 12 | API endpoints: 12 |
| Disaster (GPS, alerts): 17 | Disaster data: 7 |
| Education (alerts, scoring, sessions): 24 | Flood prediction: 3 |
| Integration (API endpoints): 14 | Education alerts: 10 |
| Network (MQTT QoS): 15 | Network monitoring: 5 |
| Resources: 30 | Resource prediction: 3 |
| Sync: 138 | Camp data integrity: 1 |

### Regression Workflow

1. Identify affected platform → run only that suite (run both for integration changes)
2. Add tests for new functionality
3. Fix failing tests — never disable or delete them to make the suite pass

**Integration change triggers:** MQTT payload structure, `DEVICE_ID`/`CAMP_ID` handling, cloud sync protocol, shared data contracts.

### Known Gaps

- RPi/Cloud frontends — no automated tests
- MQTT end-to-end — unit tests mock MQTT (no live broker tests)
- Cloud PostgreSQL — tests run in in-memory mode
- Edge Gateway (Python) — no automated tests

---

## 11. Credentials & Access

| Service | Details |
|---------|---------|
| **Turso DB URL** | `libsql://pages-pasinduhansana.aws-ap-northeast-1.turso.io` |
| **Turso Token** | `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzUyOTk5MTAsImlkIjoiMDE5ZDU4MWEtMTcwMS03ZTQ5LWFhNTktOWI5NWVkMGM0MDVmIiwicmlkIjoiNWQ2ZmEwMmEtNWU3MC00Nzk4LTkzMDYtMjc2MDM3YzgwNWRmIn0.Qb78x5OAGFnOa1moQILg7ZkFFRkKTGYQoq3rS0aCDGWolgpanhVh2VbN7nV7Moh6OyMbKCSND9KJBjWfQAt3BA` |
| **Turso Login** | gallagepasinduhansana@gmail.com / Pasi@1225 |
| **AWS SSH** | root@123$ / rooT@123$ |

---

## 12. Future Enhancements

- 🛰 Satellite communication support
- 🚁 Drone-based delivery system
- 🤖 AI crowd analysis
- 🔗 Blockchain aid tracking
- 🧠 Federated learning across regions

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:2563eb,100:0ea5e9&height=140&section=footer&text=Technology%20Should%20Not%20Stop%20When%20Disasters%20Begin&fontSize=20&fontColor=ffffff"/>

### 🌍 SDRC-BOX
**AI + IoT + Edge + Cloud for Humanitarian Intelligence**

</div>
