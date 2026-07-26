# Smart Disaster Relief Camp Box (SDRC-Box)

An integrated IoT + AI framework for rapid deployment in disaster-stricken areas. It serves as a localized intelligence hub for environmental monitoring, camp resource logistics, and psycho-educational support for displaced individuals.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│   SENSOR NODE   │     │   EDGE GATEWAY    │     │  RASPBERRY PI 5  │     │     CLOUD VM (AWS)   │
│    (ESP32)      │────▶│   (Intel NUC)     │────▶│  (Camp Server)   │────▶│  (Admin Dashboard)  │
│  Water Level    │     │  Flood Prediction │     │  MQTT Gateway    │     │  Next.js + Express  │
│  Rain Gauge     │     │  Hydrospatial API │     │  SQLite DB       │     │  ML Inference       │
│  GPS            │     │  DEM / GPS Module │     │  SAAMP Protocol  │     │  PAGES Edu System   │
└─────────────────┘     └──────────────────┘     └─────────────────┘     └──────────────────────┘
                                │                         │                         │
                                └──────────── MQTT/TLS ────┴───────── HTTPS ────────┘
```

## Tech Stack

| Layer | Stack |
|-------|-------|
| **Edge** | Python 3.11+, FastAPI, XGBoost, GeoPandas, NetworkX |
| **RPi Local** | Node.js, Express, React 18 + Vite, SQLite, Tailwind CSS |
| **Cloud** | Next.js 16, React 19, Express, Turso/SQLite, PostgreSQL |
| **IoT** | MQTT (EMQX Serverless), ESP32 (Arduino/C++) |
| **ML/AI** | XGBoost, scikit-learn, LightGBM, Isolation Forest |

## Repository Structure

```
SmartCamp-IoT-AI-Framework/
├── sensor-node/         # ESP32 sensor firmware (placeholder)
├── edge-gateway/        # Intel NUC: flood prediction + spatial APIs
│   ├── prediction-models/   # XGBoost, Random Forest flood models
│   └── scripts/             # FastAPI, hydrospatial, GPS, DEM services
├── raspberry-platform/  # Raspberry Pi 5: camp management server
│   ├── backend/             # Express API + SQLite + MQTT (SAAMP)
│   └── frontend/            # Vite + React local UI
└── cloud-platform/      # AWS cloud: admin dashboard + ML + education
    ├── backend/             # Express API + PAGES edu system
    ├── frontend/            # Next.js admin dashboard
    └── prediction-models/   # Resource & network ML models
```

## Key Features

- **Flood Prediction** - XGBoost model (F1=0.91) using rainfall, elevation, river proximity
- **Camp Resource Management** - QR wristband distribution, registration, check-in/out
- **SAAMP Protocol** - Semantic-Aware Adaptive Message Prioritization (Novelty)
- **PAGES Edu System** - Psycho-Attentional Gated Educational System with cognitive games
- **Real-time Monitoring** - MQTT-based with adaptive QoS and offline buffering
- **Disaster Dashboard** - Geo-maps, water levels, camp summaries

## Getting Started

### Prerequisites
- Node.js >= 20, Python 3.11+, EMQX broker (cloud or local)

### Raspberry Pi (Local Camp Server)
```bash
cd raspberry-platform/backend/res-mng_backend
npm install && npm start
```
Frontend: `cd raspberry-platform/frontend && npm install && npm run dev`

### Cloud Deployment
```bash
cd cloud-platform/backend && npm install && node src/server.js
cd cloud-platform/frontend && npm install && npm run dev
```

### Edge Gateway
```bash
cd edge-gateway/scripts && pip install -r requirements.txt
python api.py  # FastAPI on :8000
```

## Ports

| Service | Port |
|---------|------|
| Edge FastAPI | 8000 |
| RPi Backend | 5000 |
| Cloud Backend | 3001 |
| Cloud Frontend | 3000 |
| Flask ML Scoring | 5001 |
| EMQX MQTTS | 8883 |

## Research Novelty

**SAAMP** - Semantic-Aware Adaptive Message Prioritization for IoT in disaster scenarios:
- Source-Action Semantic Classification (SACS): CRITICAL/HIGH/MEDIUM/LOW priority
- Predictive network-state QoS adjustment (STABLE/DEGRADED/CRITICAL)
- Priority-ordered offline message buffering with flush on reconnect
