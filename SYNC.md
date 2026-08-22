# SmartCamp Sync System

Local SQLite → MQTT → Cloud Neon PostgreSQL synchronization for offline-first disaster relief camps.

## Architecture

```
Raspberry Pi (Offline-first)          EMQX Broker          Cloud (Neon PostgreSQL)
┌──────────────────────┐              ┌────────┐           ┌──────────────────────┐
│  Local SQLite (camp.db)│            │        │           │                      │
│  pages.db             │──publish──▶ │  MQTT  │──receive──▶│  syncReceiver        │
│                       │            │  :8883 │           │  sync.postgres.repo  │
│  sync_pending         │◀──ACK───── │  TLS   │◀─ACK─────│  sync_log            │
│  sync-manager         │            │        │           │                      │
└──────────────────────┘              └────────┘           └──────────────────────┘
```

## MQTT Topics

| Topic | Direction | Purpose |
|---|---|---|
| `smartcamp/sync/<entity>` | RPi → Cloud | Per-record sync messages |
| `smartcamp/sync/ack/<device_id>` | Cloud → RPi | ACK after Neon persistence |

Entities: `person`, `checkin`, `wristband`, `distribution`, `resource`, `resource_usage`, `audit_log`, `child`, `session`, `behavioral_signal`, `gate_decision`, `alert`, `content_response`

## Data Flow

1. **Service call** → business logic inserts/updates a row in SQLite
2. **enqueueSync()** → writes to `sync_pending` table (synchronous, no cloud dependency)
3. **sync-manager cycle** → queries `sync_pending`, classifies priority, publishes per-record via SAAMP MQTT
4. **Cloud receives** → `syncReceiver` routes to entity handler → idempotent upsert in Neon → writes `sync_log`
5. **Cloud ACKs** → publishes to `smartcamp/sync/ack/<device_id>`
6. **RPi receives ACK** → marks `synced=1` on source table + deletes from `sync_pending`

## Priority Classification

CRITICAL → HIGH → MEDIUM → LOW (oldest first within level)

| Level | Examples |
|---|---|
| CRITICAL | Pregnant person, chronic illness, medicine distribution, consecutive/3-of-5 alerts |
| HIGH | Registration, check-in, wristband, water/food, low stock, FAIL_CONFIRMED |
| MEDIUM | Normal resources, FAIL_FIRST, resolved alerts |
| LOW | Audit logs, behavioral signals, content responses, normal sessions |

## Offline Resilience

- **enqueueSync()** never throws — always succeeds locally
- **Adaptive sync interval** — adjusts to network quality:
  - `STABLE` → 5 seconds (fast sync)
  - `DEGRADED` → 15 seconds
  - `CRITICAL` → 60 seconds (defer new publishes)
- **SAAMP buffering** — non-CRITICAL messages buffered when network is CRITICAL
- **Exponential backoff** — retry 1min → 2min → 4min → 8min → 16min → 30min (max 10 retries, ~10 hours total)
- **Restart-safe** — `sync_pending` persists in SQLite, survives power loss
- **Idempotent** — cloud uses ON CONFLICT upserts + sync_log to prevent duplicates

## Files

### RPi (raspberry-platform/backend)

| File | Role |
|---|---|
| `services/sync/sync-notify.js` | `enqueueSync()` — lightweight, never throws |
| `services/sync/sync-priority.js` | Data-content-based priority classification |
| `services/sync/sync-queue.js` | Pending record discovery from SQLite |
| `services/sync/sync-manager.js` | Orchestrates publish → ACK → mark synced cycle |
| `services/network/saamp-mqtt.js` | MQTT client with buffering and adaptive QoS |
| `config/database.js` | Schema + `sync_pending` table |

### Cloud (cloud-platform/backend/src)

| File | Role |
|---|---|
| `services/sync/syncReceiver.service.js` | MQTT subscriber + ACK publisher |
| `data/sync/sync.postgres.repository.js` | 14 idempotent Neon upserts |
| `db/schema.sql` | All tables + `sync_log` |

---

## Manual Testing Guide

### Prerequisites

| Component | Required | Details |
|---|---|---|
| EMQX Broker | Yes | `mqtt://broker.emqx.io:1883` (or your own) |
| Neon PostgreSQL | Yes | Connection string in `DATABASE_URL` |
| Node.js 18+ | Yes | Both RPi and cloud backends |
| MQTT client | Optional | `mqtt-cli` or MQTTX for monitoring |

### Step 1 — Set Environment Variables

```bash
# RPi backend — CAMP_ID comes from .env (set during device provisioning)
export CAMP_DB_PATH=./data/camp.db
export PAGES_DB_PATH=./data/pages.db

# Cloud backend
export DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/smartcamp?sslmode=require
```

### Step 2 — Start Cloud Backend First

```bash
cd cloud-platform/backend
node src/server.js
```

Expected:
```
[SYNC] Sync receiver started
[SERVER] Running on port 4000
```

### Step 3 — Start RPi Backend

```bash
cd raspberry-platform/backend
node server.js
```

Expected:
```
[MQTT] Connected to broker
[SYNC] Started (interval: 30000ms, device: SCB-UNIT-01)
```

### Step 4 — Create a Test Record (RPi)

Open a second terminal, register a person via the API:

```bash
curl -X POST http://localhost:3001/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test User",
    "age": 30,
    "gender": "M",
    "is_pregnant": false,
    "has_chronic_illness": false
  }'
```

### Step 5 — Watch Sync Cycle

RPi logs (every 30s):
```
[SYNC] Queued persons id=P-001 { sync_id: "...", priority: "HIGH" }
[SYNC] Published persons id=P-001
```

Cloud logs (immediate):
```
[SYNC-RECEIVER] Received persons from SCB-UNIT-01
[SYNC-RECEIVER] ACK sent for persons id=P-001
```

RPi receives ACK:
```
[SYNC] Acknowledged persons id=P-001
[SYNC] Synchronized persons id=P-001
```

### Step 6 — Verify in Neon

```sql
SELECT id, full_name, synced FROM persons ORDER BY created_at DESC LIMIT 5;
SELECT * FROM sync_log ORDER BY received_at DESC LIMIT 5;
```

### Step 7 — Monitor MQTT Traffic

Using MQTTX or `mqtt-cli`:

```bash
# Subscribe to all sync messages
mqtt sub -h broker.emqx.io -t "smartcamp/sync/#" -v

# Subscribe to ACKs
mqtt sub -h broker.emqx.io -t "smartcamp/sync/ack/#" -v
```

You should see JSON messages like:
```json
{
  "sync_id": "uuid-here",
  "entity": "persons",
  "local_id": "P-001",
  "operation": "CREATE",
  "priority": "HIGH",
  "camp_id": "CAMP-B",
  "device_id": "SCB-UNIT-01",
  "payload": { "id": "P-001", "full_name": "Test User", ... }
}
```

### Step 8 — Test CRITICAL Priority (Pregnant Person)

```bash
curl -X POST http://localhost:3001/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Pregnant Test",
    "age": 25,
    "gender": "F",
    "is_pregnant": true,
    "has_chronic_illness": false
  }'
```

Log should show `priority: "CRITICAL"` and higher QoS (2).

### Step 9 — Test Offline / Retry

1. **Disconnect the RPi from internet** (unplug ethernet/disable wifi)
2. Register a record — it will be buffered locally
3. Check `sync_pending`:
   ```bash
   sqlite3 data/camp.db "SELECT sync_id, entity, priority, published, retry_count FROM sync_pending;"
   ```
4. **Reconnect internet** — next sync cycle publishes buffered records
5. Wait for ACK — `sync_pending` clears

### Step 10 — Test Cloud Downtime (Retry Behavior)

1. **Stop the cloud backend**
2. Register records on RPi — they publish but no ACK arrives
3. Check retry logs on RPi:
   ```
   [SYNC] Retrying 1 unacked records
   [SYNC] Retrying persons id=P-001 { retry: 1, next_retry_at: "..." }
   ```
4. **Restart cloud backend** — RPi receives ACK on next retry

### Step 11 — Test RPi Restart Survival

1. Register a record (don't wait for ACK)
2. **Kill the RPi server** (`Ctrl+C`)
3. Check `sync_pending` persists:
   ```bash
   sqlite3 data/camp.db "SELECT COUNT(*) FROM sync_pending WHERE published = 0;"
   ```
4. **Restart RPi** — `sync_pending` picks up where it left off

### Step 12 — Run Automated Tests

```bash
cd raspberry-platform/backend
npx vitest run
```

Expected: `202 passed (202)`

### Quick Smoke Test Script

```bash
#!/bin/bash
echo "=== SmartCamp Sync Smoke Test ==="

echo "1. Health check..."
curl -s http://localhost:4000/api/health | head -1

echo "2. Register person..."
curl -s -X POST http://localhost:3001/api/register \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Smoke Test","age":20,"gender":"M"}'

echo "3. Wait for sync cycle (30s)..."
sleep 32

echo "4. Check Neon..."
psql "$DATABASE_URL" -c "SELECT id, full_name FROM persons WHERE full_name='Smoke Test';"

echo "=== Done ==="
```

### Troubleshooting

| Symptom | Check |
|---|---|
| `[SYNC] Cycle failed: no such column` | Verify `sync-queue.js` `TS_COLUMN` matches your schema |
| `[MQTT] Connection refused` | Broker URL/port, TLS settings |
| No ACK received | Cloud backend running? `smartcamp/sync/ack/<device_id>` topic subscribed? |
| Records stuck in `sync_pending` | Network state? `saamp.getNetworkState()` returns what? |
| Duplicate records in Neon | Cloud uses `ON CONFLICT` — check `sync_log` for duplicate ACKs |
| `published = 1` but no ACK | SAAMP buffered → wait for flush, or check network state |
