# SDRC-Box — Project Guide

## Full Directory Tree

```
SmartCamp-IoT-AI-Framework/
│
├── .github/
│   └── workflows/
│       └── auto-pr.yml                     # Auto PR from *-dev → main
│
├── sensor-node/                            # [ESP32] Sensor firmware (placeholder)
│   └── .gitkeep
│
├── edge-gateway/                           # [Intel NUC] Edge processing
│   ├── prediction-models/                  # Flood prediction ML
│   │   ├── model_comparison.py             # Unified model evaluation
│   │   ├── comparison_results/             # CSV/JSON summaries
│   │   ├── models/                         # Trained .pkl models
│   │   │   ├── decision_tree_model.pkl
│   │   │   ├── logistic_regression_model.pkl
│   │   │   ├── random_forest_model.pkl
│   │   │   └── xgboost_model.pkl
│   │   ├── decision_tree_model/
│   │   ├── logistic_regression_model/
│   │   ├── random_forest_model/
│   │   └── xgboost_model/                  # Production model (XGBoost)
│   │       ├── xgboost_model.py
│   │       └── predict_flood.py            # CLI prediction tool
│   │
│   └── scripts/                            # Edge microservices
│       ├── api.py                          # FastAPI entry (:8000)
│       ├── requirements.txt
│       ├── digital_elevation_model/        # Elevation lookup API
│       ├── gps_module/                     # Serial GPS (NMEA) reader
│       └── hydrospatial_api/               # River/gauging station lookup
│           ├── api.py                      # FastAPI router
│           ├── service.py                  # Orchestration layer
│           └── providers/
│               ├── overpass_client.py      # OSM Overpass API
│               ├── river_lookup.py         # Nearest river finder
│               ├── gauging_station.py      # Nearest gauge finder
│               ├── river_shapefile.py      # Shapefile network analysis
│               ├── live_water_level_api.py # ArcGIS real-time levels
│               └── weather_forecast_location.py # Open-Meteo
│
├── raspberry-platform/                     # [RPi 5] Camp local server
│   ├── backend/                            # ★ UNIFIED SERVER (merged res-mng + PAGES + Flask)
│   │   ├── package.json                    # Express + MQTT + SQLite + JWT + QR
│   │   ├── server.js                       # Single entry point (:5000)
│   │   ├── config/
│   │   │   ├── constants.js                # Unified app constants
│   │   │   └── database.js                 # Dual DB: camp.db + pages.db
│   │   ├── middleware/
│   │   │   ├── auth.js                     # JWT admin middleware
│   │   │   ├── validate.js                 # Request validation
│   │   │   └── error-handler.js            # Central error handler
│   │   ├── routes/
│   │   │   ├── camp/                       # Camp operations
│   │   │   │   ├── register.js
│   │   │   │   ├── fingerprint.js
│   │   │   │   ├── checkin.js
│   │   │   │   ├── wristband.js
│   │   │   │   ├── distribute.js
│   │   │   │   ├── network.js
│   │   │   │   ├── stats.js
│   │   │   │   ├── prediction.js
│   │   │   │   └── disaster.js
│   │   │   └── education/                  # PAGES edu system
│   │   │       ├── child.js
│   │   │       ├── session.js
│   │   │       ├── dashboard.js
│   │   │       └── sync.js
│   │   ├── controllers/                    # Education controllers
│   │   │   ├── child.js
│   │   │   ├── session.js
│   │   │   ├── dashboard.js
│   │   │   └── sync.js
│   │   ├── services/
│   │   │   ├── saamp-mqtt.js               # ★ SAAMP: adaptive MQTT
│   │   │   ├── emqx-manager.js             # EMQX REST client manager
│   │   │   ├── scoring.js                  # ML scoring (Flask proxy + fallback)
│   │   │   ├── gating.js                   # PASS/FAIL gate decisions
│   │   │   ├── alert.js                    # Anomaly alerts
│   │   │   ├── connectivity.js             # PG connectivity watcher
│   │   │   ├── qr-code.js                  # QR generation
│   │   │   └── sync.js                     # Cloud sync service
│   │   ├── utils/
│   │   │   ├── logger.js                   # Timestamped SLT logger
│   │   │   └── helpers.js                  # SLT helpers, ID gen
│   │   ├── db/
│   │   │   ├── pages-schema.sql            # PAGES schema DDL
│   │   │   └── seed/tasks.js               # 110 content tasks
│   │   ├── python/                         # Flask ML scoring service
│   │   │   ├── app.py                      # Flask (:5001)
│   │   │   ├── train-model.py
│   │   │   ├── evaluate-models.py
│   │   │   ├── full-validation.py
│   │   │   ├── requirements.txt
│   │   │   └── data/session-history.json
│   │   └── scripts/                        # Utility scripts
│   │
│   └── frontend/                           # Camp local UI
│       ├── package.json                    # React 18 + Vite + Tailwind
│       └── src/
│           ├── App.jsx                     # Tab navigation
│           └── components/resources/
│               ├── PredictionScreen.jsx    # AI forecast UI
│               ├── RegistrationScreen.jsx  # Camp registration
│               └── WristbandScanScreen.jsx # QR wristband scanner
│
├── cloud-platform/                         # [AWS VM] Cloud services
│   ├── backend/
│   │   ├── package.json                    # Express + ESM
│   │   ├── .env.example                    # Config template
│   │   ├── tests/                          # node:test unit + integration
│   │   │   ├── app.test.js
│   │   │   ├── disaster/
│   │   │   ├── education/
│   │   │   ├── resources/
│   │   │   └── network/
│   │   └── src/
│   │       ├── server.js                   # Bootstrap (:3001)
│   │       ├── app.js                      # Express app factory
│   │       ├── config/
│   │       │   ├── env.js                  # Central env/config source
│   │       │   └── database.js             # SQLite connection + schema
│   │       ├── middleware/                 # errorHandler, notFound, requestLogger
│   │       ├── routers/
│   │       │   ├── index.js
│   │       │   ├── disaster.routes.js
│   │       │   ├── education.routes.js     # PAGES alerts
│   │       │   ├── resources.routes.js
│   │       │   └── network.routes.js
│   │       ├── controllers/                # disaster/, education/, resources/, network/
│   │       ├── services/                   # disaster/, education/, resources/, network/
│   │       │   ├── network/mqtt.js         # MQTT client
│   │       │   ├── network/networkMonitor.js   # QoS monitoring
│   │       │   ├── network/simulation.js   # Network simulation
│   │       │   ├── network/realNetworkMonitor.js
│   │       │   ├── resources/campDataService.js  # EMQX subscriber
│   │       │   ├── resources/predictionService.js # Weighted linear pred
│   │       │   ├── disaster/floodPredictionService.js
│   │       │   └── disaster/waterLevelHistoryService.js
│   │       ├── models/education/alert.model.js  # SQL
│   │       └── data/disaster/camps.data.js # Static camp data
│   │
│   ├── ml-service/                         # PAGES ML scoring (Flask)
│   │   ├── run.py                          # Flask entry (:5001)
│   │   ├── requirements.txt                # Flask + numpy + sklearn + pytest
│   │   ├── app/
│   │   │   ├── __init__.py                 # create_app factory
│   │   │   ├── config.py                   # Config class
│   │   │   ├── database.py                 # SQLAlchemy metadata/tables
│   │   │   ├── api/                        # health, score, history, reset
│   │   │   └── services/                   # scoring_service, history_service
│   │   ├── tests/                          # pytest suite
│   │   └── data/, models/                  # Runtime persistence dirs
│   │
│   ├── frontend/                           # Admin dashboard
│   │   ├── package.json                    # Next.js 16 + React 19
│   │   ├── next.config.mjs                 # Standalone output
│   │   ├── tailwind.config.js              # Content globs; theme lives in @theme (globals.css)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.js               # Fonts (Inter) + SideNavProvider (--rail-width)
│   │       │   ├── page.js                 # Dashboard (All Camps Overview) + side rail
│   │       │   ├── camps/                  # Redirects → / (dashboard)
│   │       │   ├── alert/                  # PAGES alerts
│   │       │   ├── education/               # Education Insights (camp selector + per-camp detail)
│   │       │   ├── analytics/               # Redirects → /education
│   │       │   ├── disaster/               # Flood disaster dashboards (+ [campId])
│   │       │   ├── network/                # Network monitoring
│   │       │   ├── resources/              # Resource overview
│   │       │   └── welfare/                # Welfare anomalies
│   │       └── components/
│   │           ├── common/                 # Shared: theme.js, utils.js, SideNav (collapsible nav rail), PageHeader, CampSidebar, SkeletonCard
│   │           ├── disaster/               # Flood maps, camp summary
│   │           ├── resources/              # Resource overview
│   │           ├── education/              # Edu dashboards + games (was psychoedu/)
│   │           └── network/                # Network monitoring UI (was mqtt-manager/)
│   │
│   └── prediction-models/                  # ML training pipeline
│       ├── requirements.txt
│       ├── data/
│       │   ├── raw/
│       │   └── processed/
│       ├── notebooks/                      # Jupyter notebooks
│       │   ├── 01_explore_kaggle_data.ipynb
│       │   ├── 02_resource_prediction_model.ipynb
│       │   ├── 03_network_prediction_model.ipynb
│       │   └── 04_validate_with_real_data.ipynb
│       └── src/
│           ├── resource_predictor.py       # Resource demand predictor
│           ├── network_predictor.py        # Network state predictor
│           ├── data_generator.py           # Synthetic data
│           ├── feature_extraction.py       # Feature engineering
│           └── predict_manual.py
│
├── .gitignore
├── README.md
└── GUIDE.md                                # ← You are here
```

---

## Architecture Diagrams

### 1. System Architecture (Component View)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                               SDRC-Box SYSTEM ARCHITECTURE                               │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │    SENSOR NODE      │    │    EDGE GATEWAY      │    │    RASPBERRY PI 5          │  │
│  │    (ESP32)          │    │    (Intel NUC)        │    │    (Camp Local Server)     │  │
│  │                     │    │                       │    │                             │  │
│  │  ┌───────────────┐  │    │  ┌─────────────────┐ │    │  ┌───────────────────────┐ │  │
│  │  │ Water Level   │──┼────┼─▶│ FastAPI (:8000)  │ │    │  │ Express API (:5000)   │ │  │
│  │  │ Sensor        │  │    │  │ Hydrospatial API │ │    │  │ Registration          │ │  │
│  │  └───────────────┘  │    │  │ River Lookup     │ │    │  │ Check-in/out         │ │  │
│  │  ┌───────────────┐  │    │  │ GPS/Weather/DEM  │ │    │  │ Wristband Tracking   │ │  │
│  │  │ Rain Gauge    │──┼────┼─▶│                  │ │    │  │ Resource Distribution│ │  │
│  │  └───────────────┘  │    │  └─────────────────┘ │    │  │ Forecast Orchestrator│ │  │
│  │  ┌───────────────┐  │    │                       │    │  └───────────────────────┘ │  │
│  │  │ GPS Module    │──┼────┼─▶  ┌─────────────────┐│    │                             │  │
│  │  └───────────────┘  │    │  │ XGBoost Flood     ││    │  ┌───────────────────────┐ │  │
│  │                     │    │  │ Prediction Model  ││    │  │ SQLite Database       │ │  │
│  │  Serial/UART        │    │  │ (F1=0.91,AUC=0.95)││    │  │ persons, checkins,    │ │  │
│  └─────────────────────┘    │  │ Features: rain,   ││    │  │ wristbands, dist.,    │ │  │
│                              │  │ elevation, river, ││    │  │ mqtt_buffer           │ │  │
│                              │  │ lat, lon          ││    │  └───────────────────────┘ │  │
│                              │  └─────────────────┘│    │                             │  │
│                              │                       │    │  ┌───────────────────────┐ │  │
│                              │                       │    │  │ ★ SAAMP MQTT Layer   │ │  │
│                              │                       │    │  │ Semantic Classification│ │  │
│                              │                       │    │  │ Adaptive QoS          │ │  │
│                              │                       │    │  │ Offline Buffer Queue  │ │  │
│                              │                       │    │  └───────────────────────┘ │  │
│                              └─────────────────────┘    └─────────────────────────────┘  │
│                                       │                           │                     │
│                                       └───────────────────────────┼─────────────────────┘
│                                                                   │
│                                          ┌────────────────────────┘
│                                          ▼
│                              ┌─────────────────────────┐
│                              │   EMQX CLOUD BROKER     │
│                              │   (MQTTS :8883)         │
│                              │   smartcamp/# topics    │
│                              └─────────────────────────┘
│                                          │
│                                          ▼
│                              ┌──────────────────────────────────────────────────────────┐
│                              │              CLOUD VM (AWS)                               │
│                              │                                                           │
│                              │  ┌──────────────────┐  ┌──────────────────────────────┐  │
│                              │  │ Express (:3001)   │  │  Next.js Frontend (:3000)    │  │
│                              │  │ Network Monitor   │  │  ┌────────────────────────┐ │  │
│                              │  │ Camp Data Service │  │  │ Admin Dashboard        │ │  │
│                              │  │ Resource Predict  │  │  │ ├ Disaster Monitoring  │ │  │
│                              │  │ Flood Predict     │  │  │ ├ Resource Panel       │ │  │
│                              │  │ Disaster Routes   │  │  │ ├ MQTT Network UI      │ │  │
│                              │  └──────────────────┘  │  │ └ PsychoEdu Dashboard   │ │  │
│                              │                         │  └────────────────────────┘ │  │
│                              │  ┌──────────────────┐  │  ┌────────────────────────┐ │  │
│                              │  │ PAGES Backend    │  │  │ Child Mode             │ │  │
│                              │  │ Student Enroll    │  │  │ Educational Games      │ │  │
│                              │  │ Go/No-Go Games   │  │  │ Cognitive Training     │ │  │
│                              │  │ Turso/SQLite DB  │  │  └────────────────────────┘ │  │
│                              │  └──────────────────┘  └──────────────────────────────┘  │
│                              │                         ┌──────────────────────────────┐  │
│                              │  ┌──────────────────┐  │  Prediction Models           │  │
│                              │  │ Flask ML (:5001) │  │  ├ Resource Predictor        │  │
│                              │  │ Z-score + IsoFor │  │  ├ Network Predictor         │  │
│                              │  │ Composite Score  │  │  └ Jupyter Notebooks         │  │
│                              │  └──────────────────┘  └──────────────────────────────┘  │
│                              └──────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2. Data Flow Diagram

```
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐    ┌───────────┐
│  ESP32   │───▶│  Edge    │───▶│  RPi SAAMP   │───▶│  EMQX    │───▶│   Cloud   │
│ Sensors  │    │  Gateway │    │  MQTT Layer   │    │  Broker  │    │   VM      │
└──────────┘    └──────────┘    └──────────────┘    └──────────┘    └───────────┘
                                          │                              │
                                          │  ┌───────────────────────┐   │
                                          │  │ SAAMP Priority Queue  │   │
                                          │  │ ┌─────────────────┐   │   │
                                          │  │ │ CRITICAL QoS 2  │───┼───┼──▶ Flood alerts
                                          │  │ ├─────────────────┤   │   │
                                          │  │ │ HIGH     QoS 1  │───┼───┼──▶ Registration
                                          │  │ ├─────────────────┤   │   │
                                          │  │ │ MEDIUM   QoS 1  │───┼───┼──▶ Distribution
                                          │  │ ├─────────────────┤   │   │
                                          │  │ │ LOW      QoS 0  │───┼───┼──▶ Statistics
                                          │  │ └─────────────────┘   │   │
                                          │  └───────────────────────┘   │
                                          │                              │
                                          │  OFFLINE MODE:              │
                                          │  Buffer → Priority sort     │
                                          │  → Flush on reconnect       │
                                          └──────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        REGISTRATION & RESOURCE FLOW                                  │
│                                                                                      │
│   Person ──▶ RPi Frontend ──▶ Express API ──▶ SQLite ──▶ MQTT ──▶ EMQX ──▶ Cloud   │
│   arrives    Register           Save person     Store      Publish    Route    Camp  │
│              fingerprint       + create MQTT              SAAMP               State │
│              + QR wristband    credentials                priority            Store │
│                                                                                      │
│   Resource ──▶ RPi Frontend ──▶ Express API ──▶ SQLite ──▶ MQTT ──▶ EMQX ──▶ Cloud  │
│   distribute  Scan wristband    Record dist.    Update    Publish    Route    Admin  │
│               Select resource                    stock     SAAMP             Dashboard│
│                                                                                      │
│   Forecast ──▶ RPi Frontend ──▶ Cloud Backend ──▶ ML Model ──▶ Return 7-day        │
│   request     Demographics      Prediction         (Resource     forecast (food,   │
│               + resources       Service            Predictor)    water, staff)     │
│                                                                                      │
│   Flood   ──▶ Edge Gateway ──▶ XGBoost ──▶ Risk ──▶ MQTT ──▶ EMQX ──▶ Disaster    │
│   predict    Rainfall, elev,    Model       Alert              Broker   Dashboard  │
│              river dist, lat/lon                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3. SAAMP Protocol Flow (Novelty)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    SAAMP — Semantic-Aware Adaptive Message Prioritization        │
│                                                                                  │
│  ┌──────────────────────────┐                                                    │
│  │  SACS Classification     │                                                    │
│  │  (Source-Action)         │                                                    │
│  │                          │                                                    │
│  │  Source: REGISTER        │  ───▶ CRITICAL: flood alert, disaster              │
│  │  Action: CREATE          │  ───▶ HIGH:     registration, check-in            │
│  │  Source: DISTRIBUTE      │  ───▶ MEDIUM:   distribution, stats               │
│  │  Action: ALLOCATE        │  ───▶ LOW:      wristband scan, info              │
│  └──────────┬───────────────┘                                                    │
│             │                                                                     │
│             ▼                                                                     │
│  ┌──────────────────────────┐    ┌─────────────────────────────┐                │
│  │  Network State Predictor │───▶│  Adaptive QoS Adjustment    │                │
│  │                          │    │                             │                │
│  │  STABLE  (RTT < 100ms)   │    │  CRITICAL → QoS 2 (always) │                │
│  │  DEGRADED(RTT 100-500ms) │    │  HIGH     → QoS 2→1→0      │                │
│  │  CRITICAL(RTT > 500ms)   │    │  MEDIUM   → QoS 1→0        │                │
│  │                          │    │  LOW      → QoS 0 (always) │                │
│  └──────────────────────────┘    └─────────────────────────────┘                │
│                                             │                                     │
│                                             ▼                                     │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  OFFLINE BUFFER                                                        │   │
│  │                                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Buffer Order: CRITICAL → HIGH → MEDIUM → LOW (by priority then ts)│ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                          │   │
│  │  On reconnect: Flush all buffered messages in priority order             │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4. PAGES Edu System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│         PAGES — Psycho-Attentional Gated Educational System                  │
│                                                                              │
│  Child ──▶ Next.js Frontend ──▶ Go/No-Go Game ──▶ Session Data              │
│  Login     (Child Mode)         (Cognitive Task)   (responses, timing)      │
│                                                      │                       │
│                                                      ▼                       │
│                                           ┌─────────────────────┐           │
│                                           │ Node.js Backend     │           │
│                                           │ Store session       │           │
│                                           │ → SQLite / Turso    │           │
│                                           └─────────┬───────────┘           │
│                                                      │                       │
│                                                      ▼                       │
│                                           ┌─────────────────────┐           │
│                                           │ Flask ML Service    │           │
│                                           │ (:5001)             │           │
│                                           │                     │           │
│                                           │ 1. Composite Score  │           │
│                                           │ 2. Z-score (3+ ses)│           │
│                                           │ 3. Isolation Forest│           │
│                                           │    (8+ sessions)   │           │
│                                           └─────────┬───────────┘           │
│                                                      │                       │
│                                                      ▼                       │
│                                           ┌─────────────────────┐           │
│                                           │ Gate Decision       │           │
│                                           │ PASS / FAIL_FIRST   │           │
│                                           └─────────────────────┘           │
│                                                                              │
│   Scoring: Hit Rate + Correct Rejection Rate + Avg Reaction Time            │
│          → Z-score deviation from baseline → Anomaly detection              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Raspberry Pi SQLite)

```
persons
├── id (INTEGER PK)
├── fingerprint_id (TEXT UNIQUE)
├── full_name (TEXT)
├── age (INTEGER)
├── gender (TEXT)
├── family_unit_id (TEXT)
├── family_size (INTEGER)
├── is_pregnant (BOOLEAN)
├── has_chronic_illness (BOOLEAN)
├── medical_notes (TEXT)
├── pre_registered (BOOLEAN)
├── created_at (DATETIME)
├── synced (BOOLEAN)
├── person_type (TEXT)
├── mqtt_client_id (TEXT UNIQUE)
└── mqtt_password (TEXT)

camp_checkins
├── id (INTEGER PK)
├── person_id (FK → persons.id)
├── checkin_time (DATETIME)
├── camp_day (INTEGER)
├── is_new_arrival (BOOLEAN)
└── synced (BOOLEAN)

wristbands
├── id (INTEGER PK)
├── person_id (FK → persons.id)
├── barcode (TEXT UNIQUE)  ← QR code
├── issued_at (DATETIME)
├── is_active (BOOLEAN)
└── synced (BOOLEAN)

distributions
├── id (INTEGER PK)
├── wristband_barcode (FK → wristbands.barcode)
├── resource_type (TEXT)    ← food/water/medicine/shelter
├── quantity (REAL)
├── distributed_at (DATETIME)
└── synced (BOOLEAN)

mqtt_buffer                    ← SAAMP offline buffer
├── id (INTEGER PK)
├── topic (TEXT)
├── payload (TEXT)
├── priority (TEXT)           ← CRITICAL/HIGH/MEDIUM/LOW
├── qos (INTEGER)             ← 0/1/2
├── created_at (DATETIME)
└── flushed (BOOLEAN)

prediction_requests
├── id (INTEGER PK)
├── inputs (TEXT)             ← JSON demographics
├── status (TEXT)
├── created_at (DATETIME)
├── sent_at (DATETIME)
└── result (TEXT)             ← JSON forecast
```

---

## ML Models Summary

### Flood Prediction (Edge Gateway)

| Model | F1 Score | AUC | Features |
|-------|----------|-----|----------|
| **XGBoost ★** | **0.91** | **0.95** | rainfall_7d_mm, longitude, latitude, elevation_m, distance_to_river_m |
| Random Forest | 0.89 | 0.93 | Same |
| Decision Tree | 0.82 | 0.88 | Same |
| Logistic Reg. | 0.78 | 0.85 | Same |

**Training Data:** Sri Lanka flood risk dataset (25,000 rows) + OSM river network

### Resource Prediction (Cloud)

| Output | Model | Inputs |
|--------|-------|--------|
| Food (kg/day) | Weighted Linear Regression | #persons, #children, #elderly |
| Water (L/day) | Weighted Linear Regression | #persons, temperature |
| Shelter units | Weighted Linear Regression | total camp population |
| Medical staff | Weighted Linear Regression | #elderly, #pregnant, #chronic |

### Network State Prediction (Cloud)

| Output | Model | Inputs |
|--------|-------|--------|
| RTT forecast | Ridge/XGBoost | packet loss, signal strength, time of day |
| State (stable/degraded/critical) | Random Forest | RTT, jitter, loss rate, bandwidth |

### PAGES Edu Anomaly Detection

| Technique | Purpose | Minimum Sessions |
|-----------|---------|-----------------|
| Z-score | Detect deviation from avg performance | 3 |
| Isolation Forest | Detect complex anomaly patterns | 8 |

---

## MQTT Topic Structure

```
smartcamp/
├── registration/       # Person registration events
├── checkin/            # Check-in/out events
├── distribution/       # Resource distribution records
├── wristband/          # Wristband assignments
├── flood/              # Flood prediction alerts
├── network/            # Network state updates
└── prediction/         # Forecast requests/results
```

Each topic carries SAAMP priority metadata in the message payload.

---

## Ports Summary

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

## Key Research Contributions

1. **SAAMP** — Semantic-Aware Adaptive Message Prioritization
   - SACS: Source-Action Semantic Classification
   - Predictive QoS adjustment based on network state
   - Priority-ordered offline buffering

2. **PAGES** — Psycho-Attentional Gated Educational System
   - Go/No-Go cognitive assessment games
   - Z-score + Isolation Forest anomaly detection
   - Gated progression (PASS/FAIL_FIRST decision)

3. **Integrated Disaster Response Platform**
   - End-to-end from sensor → edge AI → camp management → cloud analytics
   - Offline-first design for disaster scenarios
   - Resource forecasting driven by real-time camp demographics
