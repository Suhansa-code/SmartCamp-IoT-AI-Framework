# Raspberry Platform — SmartCamp Local Server

The Raspberry Pi 5 node runs the camp-local unified backend (Express + Flask) and frontend (React), providing **offline-first** camp management, PAGES psycho-education, and SAAMP MQTT communication. This document describes improvements made across four dimensions.

---

## Performance

| Area | Improvement |
|------|-------------|
| **Database** | SQLite with WAL journal mode + `synchronous = NORMAL` enables concurrent reads during writes; prepared statements via `better-sqlite3` eliminate query parse overhead. |
| **MQTT Messaging** | SAAMP protocol buffers messages by priority (`CRITICAL > HIGH > MEDIUM > LOW`) and flushes in order on reconnect — no message loss during network outages. Adaptive QoS (0/1/2) based on predicted network state (`STABLE`/`DEGRADED`/`CRITICAL`) avoids wasting bandwidth on retransmits. |
| **Scoring Pipeline** | Dual-stack scoring: primary Flask ML service (port 5001) with synchronous fallback to Node.js in-process computation — zero downtime if Python is unreachable. |
| **Static Data** | Distribution quantities and disaster camp data are cached in-memory after first read (`_quantities`), avoiding repeated disk I/O. |
| **PostgreSQL Pool** | Connection pool capped at 5 with 30s idle timeout and 5s connection timeout — avoids connection storms to cloud RDS. |
| **Dev Workflow** | `node --watch` (Node 20+) for instant restart on file change; no external watcher dependency. |
| **Frontend Build** | Vite 5 with fast HMR and tree-shaken production builds. |

---

## Architecture

```
raspberry-platform/
├── backend/
│   ├── server.js              ← Entry point / middleware pipeline
│   ├── config/                 ← Constants + DB init (SQLite + PG)
│   ├── middleware/             ← Auth, validation, error handler
│   ├── routes/                 ← HTTP routing (thin, delegates to controllers)
│   ├── controllers/            ← Request/response handling (thin, delegates to services)
│   ├── services/               ← Business logic (testable, no HTTP coupling)
│   │   ├── resource/           ← Person registration, check-in, distribution, wristbands
│   │   ├── network/            ← SAAMP MQTT, EMQX REST API, connectivity watcher
│   │   ├── education/          ← Scoring, gating, alerts, sync, QR codes
│   │   └── disaster/           ← Camp data + model metrics aggregation
│   ├── python/                 ← Flask ML scoring service (Isolation Forest, Z-score)
│   └── db/                     ← SQL schemas, seed scripts
└── frontend/
    └── src/
        ├── components/
        │   ├── resources/      ← Camp ops UI (dashboard, registration, wristband scan)
        │   ├── psychoedu/      ← PAGES child education flow
        │   ├── adult/          ← Adult QR-gated self-service flow
        │   └── ...             ← Auth, navbar, routing
        └── lib/                ← Router, auth context
```

| Principle | Implementation |
|-----------|---------------|
| **3-Layer Separation** | `routes` (HTTP) → `controllers` (req/res) → `services` (business logic). Each layer has a single responsibility. |
| **Domain Packaging** | Resources, network, education, disaster each live in their own directory with co-located routes, controllers, and services. |
| **Offline-First** | SQLite is the primary store; cloud sync (Turso/PostgreSQL) is a non-blocking background operation. All camp features work without internet. |
| **Graceful Degradation** | Flask unreachable → Node.js fallback scoring. EMQX API key missing → local-only operation. PG offline → camp continues, sync retries later. |
| **Dual-Stack ML** | Flask handles production scoring (Isolation Forest, Z-score); Node.js fallback mirrors the same formula for offline resilience. |

---

## Design

| Aspect | Practice |
|--------|----------|
| **Configuration** | Centralised `constants.js` reads all env vars with validated defaults, type coercion (`parseOrigins`, `parseBoolean`, `firstDefined`), and deduplication. |
| **Validation** | Request-level validation middleware (`validate.js`) with descriptive error messages — catches missing/invalid fields before they reach business logic. |
| **Error Handling** | Unified error-handler middleware returns `{ success, message }` JSON; development mode includes stack traces. `createError()` utility for consistent HTTP error objects. |
| **Logging** | Structured logger with ISO-8601 timestamps (Asia/Colombo), level gating (`DEBUG` in dev, `INFO` in prod), and optional meta objects. |
| **Auth** | JWT middleware (`requireAdmin`) with early rejection (401) and user role extraction into `req.user`. |
| **Frontend State** | Stateless components with `fetch` polling (15s dashboard refresh); error + loading + empty states in every screen. |
| **UI Patterns** | Framer Motion for micro-animations; Tailwind CSS utility classes with consistent color tokens; responsive grid layouts with stat cards, progress bars, and network badges. |
| **MQTT Classification** | `classifyMessage(source, action)` table-driven mapping → `{ priority, qos }` — easy to extend without touching control flow. |

---

## Production-Grade

| Concern | Safeguard |
|---------|-----------|
| **Security** | Helmet (`contentSecurityPolicy: false`), JWT auth, configurable CORS with origin whitelist, request body limit (1 MB), `.env` excluded from git, CA cert for MQTTS. |
| **Resilience** | SQLite WAL + NORMAL sync for crash recovery. MQTT auto-reconnect (2s period). Flask health check on startup — logs warning if unreachable but does not crash. `syncInProgress` guard prevents concurrent cloud syncs. |
| **Observability** | Unified `/api/health` endpoint returns device/camp identity + service status. Structured logging with level-based filtering. Connectivity watcher logs PostgreSQL reachability every 30s. |
| **Data Integrity** | SQLite foreign keys enabled. Migration system for schema changes (`ALTER TABLE ADD COLUMN` with graceful fallback). Atomic `flushBuffer` transaction marks messages flushed only after successful publish. |
| **Fail-Safe** | `failFast` on PAGES DB init failure. MQTT publish timeout (8s) triggers buffer fallback. Fallback scoring returns safe defaults (compositeScore=50, gate=PASS) if even Node.js computation fails. |
| **Deployment** | Node >= 20 required (ESM modules). `.gitignore` excludes `node_modules/`, `.env`, `*.db`, `python/venv/`, `models/`. Seeded sample data (4 persons) on first run for immediate demo. |
| **Scalability** | Stateless Express design — horizontal scaling behind a reverse proxy is straightforward. Frontend is fully static (Vite build) and can be served by nginx or CDN. |

---

## Frontend Flows

### Adult Flow (`/adult`)

Self-service kiosk flow for adult residents — accessible from the **Adult** navbar tab or the `/adult` URL. Nothing is persisted: reloading the page (or pressing **Exit**) returns to the login gate.

```
QR Login ──validate──► My Resources ──► Guidance
   ▲        (camp.db)        ▲             │
   └───────── Exit ──────────┴─────────────┘
```

| Step | Behaviour |
|------|-----------|
| **1. QR Login** | Camera scan (reuses `resources/QRScanner`) or manual code entry. Payload may be a plain wristband code, a QR identifier/barcode, or a JSON QR — child QRs are rejected with a message directing to the children's programme. |
| **2. Local DB validation** | `GET /api/qr/:code` → `services/resource/qr.js resolveQR` checks wristband `qr_identifier`/barcode against **camp.db**: inactive wristband → rejected, already assigned → rejected, no active person → rejected. No valid scan ⇒ no access (no backend changes required — the endpoint has no auth middleware for kiosk use). |
| **3. My Resources** | Personal view from the login payload: daily ration entitlements (`given`/`left`), meal flags, itemised receipts, water issued vs. max — plus camp inventory from `GET /api/resources/summary`, cached in `localStorage` (`adult:inventory`) so the page still renders offline. |
| **4. Guidance** | Offline-first guidance carousel (auto-rotates every 7s) with bundled mock items covering recovery, livelihoods, health, schooling, wellbeing, and assistance — intended to read as camp guidance. Data comes from `components/adult/guidanceData.js getGuidanceItems()`; swapping the mock for fetched data is a single fetch call (documented in that file). |

**Files:** `frontend/src/components/adult/` — `AdultFlow.jsx` (session guard + segmented nav), `AdultLoginPage.jsx`, `AdultResourcesPage.jsx`, `AdultGuidancePage.jsx`, `guidanceData.js`; routed in `App.jsx`, tab in `components/ui/layout/Navbar.jsx`.

---

## Quick Start

### Recommended: separate managed services

Run Express, Flask ML, and the network prediction monitor as independent
containers. A failure or restart in one service does not terminate the others.

```bash
cd raspberry-platform/backend
cp .env.example .env
npm run stack:start
npm run stack:logs
```

The default stack uses fingerprint simulation and does not require a serial
device. On a Raspberry Pi with the ESP32/R503 attached, enable the hardware
override:

```bash
docker compose -f docker-compose.yml -f docker-compose.hardware.yml up -d --build
```

### Native development

Native processes must be started separately. `npm start` intentionally starts
only Express; it is not a Python process supervisor.

```bash
# Terminal 1: Express API
cd raspberry-platform/backend
cp .env.example .env
npm install
npm start

# Terminal 2: Flask scoring model
cd raspberry-platform/backend/python
pip install -r requirements.txt
python app.py

# Terminal 3: network prediction monitor
cd raspberry-platform/prediction-models
pip install -r requirements.txt
python3 scripts/network_monitor_service.py --backend http://localhost:5000

# Terminal 4: frontend
cd raspberry-platform/frontend
npm install
npm run dev
```

| Service | Port | Description |
|---------|------|-------------|
| Express API | 5000 | Camp operations + PAGES education API |
| Flask ML | 5001 | Anomaly detection / scoring service |
| Network monitor | — | Measures connectivity, runs the network/QoS models, and pushes state to Express |
| Frontend (Vite) | 5173 | React camp dashboard UI |
