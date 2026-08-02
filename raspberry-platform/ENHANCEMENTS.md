# Raspberry Platform — Enhancement Roadmap

Potential enhancements identified across the raspberry-platform codebase, ordered by impact and urgency for deployment on Raspberry Pi hardware.

---

## 1. Testing & Quality Assurance

| Gap | Status | Enhancement |
|-----|--------|-------------|
| **No test files** | **DONE** — 39 backend unit tests, all passing | Add unit tests for services (Jest/Vitest) — `services/education/scoring.js` fallback logic, `services/resource/register.js` business rules, SAAMP message classification. |
| **No integration tests** | **DONE** — 9 API integration tests, all passing | API-level tests with supertest — validate each route against known DB fixtures. |
| **No frontend tests** | **DONE** — 17 component tests, all passing | Component tests (React Testing Library) for dashboard, registration screen, wristband scan flow. |
| **E2E missing** | **DONE** — Playwright E2E with API route interception | Playwright for full registration → wristband → distribution flow. |
| **No CI test runner** | `.github/workflows/` runs auto-PR only — add `npm test`, `npm run lint`, and Playwright gate. |

**Target:** `npm test` passes before any merge.

---

## 2. Containerization & Deployment

| Gap | Enhancement |
|-----|-------------|
| **No Dockerfile** | Multi-stage Dockerfile — Node build, minimal `node:20-alpine` runtime, Python sidecar for Flask. |
| **No docker-compose** | `docker-compose.yml` to orchestrate Express + Flask + (optional) EMQX local broker for offline testing. |
| **No systemd unit** | `.service` file for `raspberry-platform-backend` and `raspberry-platform-flask` — auto-start on RPi boot, restart on crash. |
| **No health check endpoint for reverse proxy** | Add HTTP health probe path (`/healthz`) that returns 200 only when DB + MQTT + Flask are all reachable. |
| **No image tagging strategy** | Define `git tag` → `docker tag` convention for rollback-safe deployments. |

**Target:** Single `docker compose up` to run the full stack on RPi 5.

---

## 3. Observability & Monitoring

| Gap | Enhancement |
|-----|-------------|
| **No metrics endpoint** | Add `/api/metrics` (Prometheus format) exposing: persons registered, distributions today, MQTT buffer depth, Flask health, sync lag. |
| **No structured telemetry** | Migrate logger to Pino or Winston — JSON output, log levels, request IDs for traceability. |
| **No error tracking** | Integrate Sentry (or open-source GlitchTip) for crash reports — especially important for offline RPi deployments where console logs are hard to access. |
| **No uptime monitoring** | Simple health check cron on RPi that writes status to a GPIO LED or LCD — visual indicator of system health. |
| **No database size tracking** | Log SQLite file sizes on startup — detect unexpected growth from buffer tables or sync queues. |

**Target:** `curl localhost:5000/api/metrics` returns full system state.

---

## 4. Security Hardening

| Gap | Enhancement |
|-----|-------------|
| **JWT secret in env file** | Commit `.env.example` only; add `.env` validation at startup that rejects weak/default secrets (`CHANGE_THIS_SECRET`, `change_this_to_a_long_...`). |
| **No rate limiting** | Add `express-rate-limit` — 100 req/min per IP on auth endpoints, 1000 req/min on data endpoints. |
| **No input sanitization** | Add `xss-clean` or `helmet` XSS filter for free-text fields (`full_name`, `medical_notes`). |
| **CORS too permissive** | Restrict `credentials: true` to known origins only; remove wildcard fallback for `!origin`. |
| **No audit log** | Log all admin actions (registration, data delete, config change) to append-only `audit.db`. |
| **Secrets in `.env` committed** | `.env` is in `.gitignore` but AWS RDS password and Turso token were previously committed — rotate immediately, add `secret scanning` to CI. |
| **No HTTPS** | RPi serves HTTP on port 5000 — add auto-provisioned TLS via `certbot` or Tailscale Funnel for remote admin. |

**Target:** OWASP top-10 compliant deployment.

---

## 5. Infrastructure & Reliability

| Gap | Enhancement |
|-----|-------------|
| **No graceful shutdown** | `server.listen` has no `SIGTERM`/`SIGINT` handler — add one to close MQTT client, flush buffer, close DB connections cleanly. |
| **No watchdog** | If Flask or MQTT disconnect, auto-restart them. Option: use RPi hardware watchdog for OS-level reboot on hang. |
| **No backup/restore** | Cron job: `sqlite3 camp.db ".backup backups/camp-$(date +%F).db"` — keep last 7 days; S3 sync when online. |
| **No DB migration framework** | `ALTER TABLE ... ADD COLUMN` with try/catch works but is fragile — adopt `node-pg-migrate` or `umzug` for versioned, repeatable migrations. |
| **Connection leak risk** | `checkFlaskHealth` on every request creates axios instance — reuse a single `axios.create()` with base URL. |

**Target:** RPi survives power loss without data corruption and auto-recovers.

---

## 6. Performance (RPi-Specific)

| Gap | Enhancement |
|-----|-------------|
| **SQLite on SD card** | RPi SD cards have limited write endurance — move `*.db` to RAM disk (`/dev/shm/camp.db`) with periodic sync to persistent storage. Or use WAL mode + increase checkpoint threshold. |
| **No connection pooling for MQTT** | Each `publishAsClient` creates a new MQTT connection (8s timeout) — pool persistent connections per client or batch publications. |
| **Flask on same RPi** | Flask ML scoring (numpy/scikit-learn) is CPU-heavy — consider moving to Intel NUC edge gateway or use ONNX Runtime with ARM-optimized inference. |
| **Polling frontend** | Dashboard polls `/api/stats/overview` every 15s — replace with Server-Sent Events (SSE) for push updates, reducing RPi CPU wakeups. |
| **Large JSON payloads** | Disaster camp data (`camps.json`) loaded entirely into memory — paginate or stream for large camps. |
| **No response compression** | Add `compression` middleware (Express) — reduces bandwidth on low-power RPi WiFi. |

**Target:** RPi 5 idle CPU < 15%, peak response < 200ms.

---

## 7. Developer Experience & Code Quality

| Gap | Enhancement |
|-----|-------------|
| **No TypeScript** | All `.js` files — gradual migration improves safety for the growing codebase. Start with shared types (`config/constants.js` → `config/constants.ts`). |
| **No API docs** | Add OpenAPI 3.0 spec — `@routes` JSDoc annotations + `swagger-jsdoc` / `scalar` UI. |
| **Inconsistent error responses** | Some endpoints return `{ error }`, others `{ success: false, message }` — standardize on `{ success, message, data }`. |
| **No ESLint config committed** | `package.json` has `"lint": "eslint ."` but no `.eslintrc` — add flat config with `eslint:recommended` + `plugin:node/recommended`. |
| **Hardcoded fallback scores** | `fallbackScore` returns hardcoded 50 on internal error — this silently hides bugs. Log + rethrow for early detection. |
| **No environment validation** | Startup should validate all required env vars are set (`JWT_SECRET`, `CAMP_ID`) and fail fast with clear message. |
| **sync.js uses `??` placeholder** | `'SELECT * FROM ?? WHERE ...'` passes literal `??` to SQLite — no prepared statement parameterisation for table names. This is correct but fragile; validate table name against whitelist. |

**Target:** `npm run lint` passes, `npm run typecheck` passes, all endpoints documented.

---

## 8. Features for Field Deployment

| Gap | Enhancement |
|-----|-------------|
| **Offline fallback for frontend assets** | PWA manifest + service worker — cache all JS/CSS so the UI works even if the RPi HTTP server is restarted. |
| **Multi-language support** | PAGES education content is in English only — add i18n (i18next) for Sinhala, Tamil. |
| **Bulk import** | No CSV/JSON upload for pre-registered persons — needed for large camp influx. |
| **Data export** | No endpoint to export camp data as CSV for UNHCR reporting. |
| **Role-based access** | Only `requireAdmin` exists — add `operator` (can register/distribute) and `viewer` (read-only) roles. |
| **Audit trail** | No record of who performed what action — critical for accountability in humanitarian operations. |
| **QR wristband reprint** | No re-issue flow if wristband is lost. |
| **Distributions dashboard** | Frontend only shows today's counts — add historical trends, stock-level alerts. |

**Target:** Feature-complete for standalone field operation without cloud dependency.

---

## Priority Matrix

| Quick Win (≤ 1 day) | Medium (≤ 1 week) | Major (≤ 1 sprint) |
|----------------------|-------------------|---------------------|
| Add `npm test` script placeholder | Dockerfile + docker-compose | TypeScript migration |
| Graceful SIGTERM handler | Systemd service files | PWA offline support |
| Env validation at startup | Sentry error tracking | Multi-language i18n |
| Compression middleware | Rate limiting | Role-based access control |
| Standardized error response format | Prometheus metrics endpoint | CSV import/export |
| SQLite RAM disk config | DB migration framework | Real-time SSE dashboard |
| .husky pre-commit lint | E2E test setup | ONNX Runtime for Flask |
