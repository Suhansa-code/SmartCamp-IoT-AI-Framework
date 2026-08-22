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
