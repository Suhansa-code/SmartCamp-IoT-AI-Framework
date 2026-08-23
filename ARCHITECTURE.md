# Smart Camp Box — System Architecture

## 1. Directory Structure

```
SmartCamp-IoT-AI-Framework/
│
├── .github/workflows/
│   └── merge-development.yml              # CI: auto-merge development → main
│
├── sensor-node/gps_bridge/
│   └── gps_bridge.ino                     # ESP32 Arduino — GPS NMEA bridge (Serial/UART)
│
├── edge-gateway/                          # Intel NUC — Edge processing
│   ├── resources/                         # Datasets & GIS shapefiles
│   ├── prediction-models/                 # Flood prediction ML
│   │   ├── base_model.py                  # ABC: BaseFloodModel (sklearn)
│   │   ├── xgboost_model/                 # ★ Production (F1=0.91, AUC=0.95)
│   │   ├── random_forest_model/
│   │   ├── decision_tree_model/
│   │   └── logistic_regression_model/
│   └── scripts/                           # FastAPI microservices (:8000)
│       ├── api.py                         # ★ Entry point
│       ├── hydrospatial_api/
│       │   ├── api.py                     # Router (predict, live-payload, nearest-river)
│       │   ├── service.py                 # Orchestration
│       │   └── providers/                 # OSM, ArcGIS, Open-Meteo, shapefile
│       ├── gps_module/
│       └── digital_elevation_model/
│
├── raspberry-platform/                    # Raspberry Pi 5 — Camp local server
│   ├── backend/                           # ★ Unified Express + Flask backend
│   │   ├── server.js                      # Express entry (:5000)
│   │   ├── config/                        # constants.js, database.js (SQLite × 2 + PG)
│   │   ├── middleware/                     # auth.js, validate.js, error-handler.js
│   │   ├── routes/
│   │   │   ├── resource/                  # register, checkin, wristband, distribute, stats
│   │   │   ├── education/                 # child, session, dashboard, sync
│   │   │   ├── disaster/
│   │   │   └── network/
│   │   ├── controllers/
│   │   ├── services/
│   │   │   ├── network/saamp-mqtt.js      # ★ SAAMP: Semantic-Aware MQTT
│   │   │   ├── education/                 # scoring, gating, alert, sync
│   │   │   ├── resource/
│   │   │   └── disaster/
│   │   ├── python/app.py                  # Flask ML scoring (:5001)
│   │   ├── db/                            # pages-schema.sql, seed/tasks.js
│   │   └── models/                        # Runtime: per-child IF models
│   └── frontend/                          # Camp local UI (React + Vite + Tailwind)
│       └── src/
│           ├── App.jsx                    # Tab navigation (Admin + Child modes)
│           ├── components/
│           │   ├── resources/             # RegistrationScreen, WristbandScan, etc.
│           │   ├── disaster/              # DisasterMonitorPage
│           │   └── childEducation/        # ChildEducationScreen
│           └── lib/                       # router.jsx, AuthContext.jsx, tokens.js
│
├── cloud-platform/                        # AWS VM — Cloud services
│   ├── backend/                           # Cloud Express API (:3001)
│   │   ├── src/
│   │   │   ├── server.js                  # Bootstrap
│   │   │   ├── app.js                     # Express factory
│   │   │   ├── routers/                   # /disaster, /alerts, /resources, /network
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   │   ├── disaster/              # floodPrediction, waterLevelHistory
│   │   │   │   ├── education/alertSync    # MQTT subscriber for PAGES alerts
│   │   │   │   ├── resources/             # campData (EMQX subscriber), prediction
│   │   │   │   └── network/               # mqtt, networkMonitor, simulation
│   │   │   ├── models/education/
│   │   │   └── db/                        # schema.sql, init.js, seed.js
│   │   └── tests/
│   ├── ml-service/                        # ★ PAGES ML Scoring (Flask :5001)
│   │   ├── run.py                         # Entry
│   │   └── app/
│   │       ├── database.py                # SQLAlchemy tables
│   │       ├── api/                       # health, score, history, reset
│   │       └── services/                  # scoring, history
│   ├── frontend/                          # ★ Admin Dashboard (Next.js 16 + React 19)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.js              # ThemeProvider, fonts
│   │       │   ├── page.js                # Dashboard (All Camps Overview)
│   │       │   ├── alert/                 # PAGES alerts
│   │       │   ├── education/             # Education insights
│   │       │   ├── disaster/              # Flood disaster dashboards
│   │       │   ├── resources/             # Resource overview
│   │       │   └── network/               # Network monitoring
│   │       └── components/
│   │           ├── common/                # theme.js, SideNav, PageHeader, Button, SearchBar
│   │           ├── alert/                 # AlertCard, ArrowChip, SeverityBadge
│   │           ├── dashboard/             # KpiCard, MiniStat, StatusDonut, ProgressBar
│   │           ├── disaster/
│   │           ├── education/
│   │           ├── network/
│   │           └── resources/
│   └── prediction-models/                 # ML training pipeline
│       ├── src/
│       │   ├── resource_predictor.py      # Weighted Linear Regression
│       │   └── network_predictor.py       # Random Forest
│       ├── models/
│       └── notebooks/                     # Jupyter exploration
│
├── AGENTS.md                              # AI development guidelines
├── GUIDE.md                               # Comprehensive project guide
├── README.md                              # Project overview
└── ARCHITECTURE.md                        # This file
```

---

## 2. Layer Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3 — Cloud Platform (AWS VM)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Next.js 16   │  │ Express API  │  │ Flask ML Service      │  │
│  │ Admin UI     │  │ :3001        │  │ PAGES Scoring :5001   │  │
│  │              │←→│ PostgreSQL   │←→│ SQLAlchemy            │  │
│  └──────────────┘  └──────┬───────┘  └───────────────────────┘  │
│                           │ MQTT Subscribe                       │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │  EMQX Broker  │
                    │  MQTTS :8883  │
                    └───────┬───────┘
                            │ MQTT Publish
┌───────────────────────────┼─────────────────────────────────────┐
│  Layer 2 — Raspberry Pi 5 (Camp Local Server)                  │
│  ┌──────────────┐  ┌──────┴───────┐  ┌───────────────────────┐  │
│  │ React + Vite │  │ Express API  │  │ Flask ML Scoring      │  │
│  │ Camp UI      │←→│ :5000        │←→│ :5001                 │  │
│  │              │  │ SAAMP MQTT   │  │ Composite/Z/IF        │  │
│  └──────────────┘  └──────┬───────┘  └───────────────────────┘  │
│                           │ SQLite × 2 (camp.db + pages.db)     │
└───────────────────────────┼─────────────────────────────────────┘
                            │ HTTP :8000
┌───────────────────────────┼─────────────────────────────────────┐
│  Layer 1 — Intel NUC (Edge Gateway)                            │
│  ┌────────────────────────┴───────────────────────────────────┐ │
│  │  FastAPI :8000                                             │ │
│  │  ├─ XGBoost Flood Prediction                               │ │
│  │  ├─ Hydrospatial APIs (OSM, ArcGIS, Open-Meteo)           │ │
│  │  ├─ GPS Module (Serial/UART)                               │ │
│  │  └─ Digital Elevation Model                                │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Serial/UART
┌───────────────────────────┼─────────────────────────────────────┐
│  Layer 0 — ESP32 Sensor Node                                   │
│  ┌────────────────────────┴───────────────────────────────────┐ │
│  │  gps_bridge.ino — GPS NMEA data → Serial @ 115200 baud    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Sensor** | Arduino C++ / ESP32 | GPS NMEA bridge |
| **Edge** | Python / FastAPI / XGBoost | Flood prediction + hydrospatial APIs |
| **RPi Backend** | Node.js 20 / Express 4 | Camp operations + education |
| **RPi Frontend** | React 18 / Vite / Tailwind 4 | Camp local UI |
| **RPi ML** | Python / Flask / sklearn | PAGES scoring (composite, Z-score, IF) |
| **Cloud Backend** | Node.js 20 / Express 4 | Cloud aggregation API |
| **Cloud Frontend** | Next.js 16 / React 19 / Tailwind 4 | Admin dashboard |
| **Cloud ML** | Python / Flask / SQLAlchemy | PAGES scoring (cloud) |
| **DB (local)** | SQLite (better-sqlite3) | camp.db + pages.db |
| **DB (cloud)** | PostgreSQL (pg) | Education + disaster |
| **MQTT** | EMQX MQTTS :8883 | smartcamp/# topics |
| **Auth** | JWT (jsonwebtoken + bcryptjs) | Admin auth on RPi |
| **Testing** | vitest, Playwright, node:test, pytest | Unit + E2E |
| **CI/CD** | GitHub Actions | development → main merge |

---

## 4. Key Component Relationships

### Theme System (Cloud Frontend)

```
layout.js
  └─ ThemeProvider (src/components/common/ThemeProvider.jsx)
       ├─ provides: { mode, T, toggle }
       ├─ T = DARK or LIGHT tokens (src/components/common/theme.js)
       ├─ STORAGE_KEY = 'smartcamp.theme'
       └─ children ──→ all pages receive T tokens

src/components/common/theme.js
  ├─ DARK = { bg, bgDeep, bgSoft, card, cardSolid, bar, border, line,
  │           text, textPrimary, textSoft, muted, dim, slate, ... }
  ├─ LIGHT = { ...same keys, light values... }
  └─ Used by: SideNav, PageHeader, Button, SearchBar, PageTitle,
              DashboardCard, KpiCard, MiniStat, ProgressBar,
              StatusDonut, AlertCard, AlertPage, DashboardPage

src/data/theme.data.js
  └─ P = fixed "nitec" white palette (legacy, being replaced by T)
```

### Navigation & Routing (Cloud Frontend)

```
src/app/layout.js
  ├─ ThemeProvider wraps everything
  ├─ Inter + Noto Sans Sinhala fonts
  └─ <slot /> renders child pages

src/app/page.js            → Dashboard (/)
src/app/alert/page.js      → PAGES Alerts (/alert)
src/app/education/page.js  → Education (/education)
src/app/disaster/page.js   → Disaster (/disaster)
src/app/disaster/[campId]/ → Camp Detail
src/app/resources/page.js  → Resources (/resources)
src/app/network/page.js    → Network (/network)

src/components/common/SideNav.jsx
  ├─ Routes: Dashboard, Education, Resources, Disaster, Alerts, Network
  ├─ Theme toggle button (sun/moon)
  ├─ LIME const = '#D8F24E' (active accent)
  └─ All colors from T tokens
```

### Data Flow — PAGES Education Scoring

```
RPi Frontend (Child Mode)
  │ POST /api/session/complete
  ▼
RPi Express (:5000) → routes/education/session.js
  │
  ▼
services/education/scoring.js → Flask :5001/score
  │
  ├─ 1. Task Score = accuracy×0.40 + (1-falseTap)×0.30 + (1-rt/800)×0.15 + (1-var/500)×0.15
  ├─ 2. Passive Score = (1-idle)×0.35 + (1-clicks/10)×0.25 + completion×0.40
  ├─ 3. Composite = task×0.50 + passive×0.30 + baseline×0.20
  ├─ 4. Z-Score (from session 3): z = (composite - mean) / std_dev
  ├─ 5. Isolation Forest (from session 8): anomaly score
  ├─ 6. Anomaly Flag: z < -2.0 OR IF score < -0.10
  ├─ 7. Gate Decision: composite ≥ 55 → PASS else FAIL_FIRST
  │
  ▼
RPi SQLite (pages.db): INSERT session + behavioral_signals + gate_decision
  │
  ▼ (if anomaly)
services/education/alert.js → alertSyncManager.js
  │
  ▼
SAAMP MQTT → smartcamp/education/alert
  │
  ▼
Cloud Backend (services/education/alertSync.service.js)
  │
  ▼
Cloud PostgreSQL: INSERT INTO alerts
  │
  ▼
Cloud Frontend: Education Dashboard → Alert notifications
```

### Data Flow — Flood Prediction

```
ESP32 → Serial/UART → Edge Gateway GPS Module
  │
  ▼
Edge Gateway (FastAPI :8000)
  ├─ OSM Overpass → Nearest River
  ├─ Gauging Station CSV + Shapefile → Station Distance
  ├─ ArcGIS → Live Water Level + Rainfall
  ├─ Open-Meteo → Weather Forecast
  ├─ Open Elevation → DEM Elevation
  │
  ▼
XGBoost Model
  Input: [rainfall_7d_mm, longitude, latitude, elevation_m, distance_to_river_m]
  Output: { flood_possibility, category, probability, forecast }
  │
  ▼
RPi Backend → SAAMP MQTT → EMQX → Cloud Backend → Disaster Dashboard
```

### Data Flow — Camp Registration

```
RPi Frontend (RegistrationScreen)
  │ fingerprint + form data
  ▼
Express :5000 → POST /api/register
  ├─ SQLite: INSERT INTO persons
  ├─ Generate MQTT credentials
  ├─ Generate QR wristband
  │
  ▼
SAAMP MQTT (saamp-mqtt.js)
  ├─ classifyMessage() → priority
  ├─ decideAdaptiveQoS() → QoS level
  │   ├─ STABLE → publish directly
  │   ├─ DEGRADED → QoS 2
  │   └─ CRITICAL → buffer in mqtt_buffer table
  │
  ▼
EMQX Broker → smartcamp/registration/new
  │
  ▼
Cloud Backend (campData.service.js) → In-memory store → Resource prediction
  │
  ▼
GET /api/resources/overview → Next.js Frontend (Resources Page)
```

### SAAMP — Offline Buffering

```
RPi detects network degradation
  │ setNetworkState("DEGRADED")
  ▼
Message arrives
  ├─ classifyMessage(source, action) → priority + base QoS
  ├─ decideAdaptiveQoS(priority, baseQos, "DEGRADED")
  │   ├─ CRITICAL → QoS 2, publish
  │   ├─ HIGH → QoS 2, publish
  │   ├─ MEDIUM → QoS 1, publish
  │   └─ LOW → skip or buffer
  │
  ▼ (if CRITICAL network)
Buffer to SQLite mqtt_buffer table:
  INSERT (topic, payload, priority, qos, flushed=0)
  │
  ▼ (reconnect)
flushBuffer():
  SELECT * FROM mqtt_buffer WHERE flushed=0
  ORDER BY priority (CRITICAL→HIGH→MEDIUM→LOW), created_at
  → Publish each → UPDATE flushed=1
```

---

## 5. Database Schema

### RPi — camp.db (SQLite)

| Table | Purpose |
|-------|---------|
| persons | Registered camp residents |
| camp_checkins | Daily check-in records |
| wristbands | QR-coded wristband tracking |
| wristband_assignments | Wristband lifecycle |
| distributions | Resource distribution log |
| resources | Inventory catalog |
| resource_usage | Per-person consumption |
| audit_logs | Audit trail |
| mqtt_buffer | SAAMP offline buffer |
| prediction_requests | Resource forecast requests |

### RPi — pages.db (SQLite)

| Table | Purpose |
|-------|---------|
| pages_admins | Admin credentials (bcrypt) |
| pages_children | Enrolled children |
| pages_sessions | Game session results |
| pages_behavioral_signals | Detailed behavioral data |
| pages_gate_decisions | PASS/FAIL_FIRST decisions |
| pages_alerts | Anomaly alerts |
| content_sessions | Educational content |
| content_tasks | MCQ tasks |
| pages_content_responses | Child responses |
| pages_sync_queue | Offline sync queue |
| pages_sync_log | Sync audit log |

### Cloud — PostgreSQL

| Table | Purpose |
|-------|---------|
| children | Cloud mirror of PAGES children |
| sessions | Cloud mirror of sessions |
| alerts | Cloud alert management |
| CAMPS | Camp + gauging station data |

---

## 6. API Endpoints

### Edge Gateway (FastAPI :8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/hydrospatial/predict?lat=&lon=&alt=` | Live flood prediction |
| GET | `/hydrospatial/live-payload?lat=&lon=&alt=` | Full live data payload |
| GET | `/hydrospatial/nearest-river-gauging-station?lat=&lon=` | Nearest river + station |

### RPi Backend (Express :5000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Register new person |
| POST | `/api/checkin` | Person check-in |
| POST | `/api/wristband` | Issue wristband |
| POST | `/api/distribute` | Distribute resource |
| GET | `/api/stats` | Camp statistics |
| POST | `/api/prediction` | Request resource forecast |
| GET | `/api/disaster` | Disaster predictions |
| POST | `/api/child` | Enroll child (PAGES) |
| POST | `/api/session` | Record game session |
| GET | `/api/dashboard` | Education dashboard |

### Cloud Backend (Express :3001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/disaster/overview` | All-camp disaster overview |
| GET | `/api/disaster/camps` | List camps |
| GET | `/api/disaster/camps/:campId/predict` | Flood prediction |
| GET | `/api/alerts` | List PAGES alerts |
| POST | `/api/alerts` | Receive alert from Pi |
| POST | `/api/alerts/:alertId/resolve` | Resolve alert |
| GET | `/api/resources/overview` | Resource overview |
| GET | `/api/network/metrics` | Network QoS metrics |
| GET | `/api/network/state` | Network state |

---

## 7. Research Components

### SAAMP — Semantic-Aware Adaptive Message Prioritization
- **SACS Classification**: Maps (source, action) → priority (CRITICAL/HIGH/MEDIUM/LOW)
- **Adaptive QoS**: Adjusts MQTT QoS based on predicted network state
- **Offline Buffer**: Priority-ordered SQLite buffering, flushed on reconnect

### PAGES — Psycho-Attentional Gated Educational System
- **Go/No-Go Game**: 90-second cognitive assessment
- **Composite Scoring**: task×0.50 + passive×0.30 + baseline×0.20
- **Z-Score Detection**: Activates from session 3
- **Isolation Forest**: Activates from session 8 (per-child model)
- **Gate Decision**: PASS (≥55) / FAIL_FIRST

### Dual ML Service Pattern
- RPi: local Flask scoring (fallback in Node.js)
- Cloud: identical Flask scoring (with DB persistence)
- Both implement the same formulas for consistency

---

## 8. External Services

| Service | Protocol | Purpose |
|---------|---------|---------|
| EMQX Cloud Broker | MQTTS :8883 | Message routing |
| OSM Overpass API | HTTP | Nearest river lookup |
| ArcGIS Water Services | HTTP | Real-time water levels |
| Open-Meteo API | HTTP | Weather forecasts |
| Open Elevation API | HTTP | DEM elevation |
| AWS RDS (PostgreSQL) | TCP :5432 | Cloud database |
