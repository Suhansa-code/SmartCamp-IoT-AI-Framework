# MQTT Architecture — SmartCamp Raspberry Platform

## Overview

The Raspberry Pi unit communicates with the cloud platform through MQTT, a lightweight publish-subscribe protocol ideal for IoT.

---

## 1. MQTT

### 1.1 Broker Configuration

| Setting | Value |
|---|---|
| Broker | EMQX Cloud (`i17140d1.ala.asia-southeast1.emqxsl.com`) |
| Port | `8883` (MQTTS / TLS) |
| CA Cert | `backend/emqxsl-ca.crt` |
| Client ID | `smartcamp_pi_<random-6-hex>` |
| Auth | `admin` / `public` (defaults, overridable via `.env`) |

Connection is established once at server boot (`server.js → mqttConnect()`). Auto-reconnects every 2 seconds.

### 1.2 Topics

| Topic | Direction | Trigger | QoS |
|---|---|---|---|
| `smartcamp/registration/new` | Pi → Cloud | New person registration | 2 (CRITICAL) |
| `smartcamp/registration/checkin` | Pi → Cloud | Person check-in | 2 (CRITICAL) |
| `smartcamp/distribution/log` | Pi → Cloud | Resource distribution (meals/water) | 2 (CRITICAL) |
| `smartcamp/prediction/forecast_request` | Pi → Cloud | ML prediction request (fallback when HTTP fails) | 1 (HIGH) |
| `smartcamp/prediction/forecast_result` | Cloud → Pi | ML prediction response | 2 |
| `smartcamp/#` | Cloud → Pi | Wildcard subscription (catches all) | 2 |

### 1.3 Message Payloads

**Registration** (`smartcamp/registration/new`):
```json
{
  "event": "new_registration",
  "person": { "id": 1, "full_name": "Kasun Perera", "age": 34, ... },
  "wristband_barcode": "WB000001",
  "timestamp": "2026-08-22T10:30:00.000Z"
}
```

**Check-in** (`smartcamp/registration/checkin`):
```json
{
  "event": "checkin",
  "person": { "id": 1, "full_name": "Kasun Perera", ... },
  "wristband_barcode": "WB000001",
  "timestamp": "2026-08-22T10:30:00.000Z"
}
```

**Distribution** (`smartcamp/distribution/log`):
```json
{
  "event": "distribution",
  "person_id": 1,
  "person_name": "Kasun Perera",
  "barcode": "WB000001",
  "resource_type": "lunch",
  "quantity": 2.5,
  "timestamp": "2026-08-22T12:00:00.000Z"
}
```

**Prediction Request** (`smartcamp/prediction/forecast_request`):
```json
{
  "request_id": 42,
  "days": [{ "date": "2026-08-22", "day_offset": 0, "inputs": { ... } }],
  "timestamp": "2026-08-22T10:30:00.000Z"
}
```

**Prediction Result** (`smartcamp/prediction/forecast_result`):
```json
{
  "request_id": 42,
  "forecasts": [{ "date": "2026-08-22", "predicted_needed": 150, ... }]
}
```

### 1.4 Adaptive QoS (Network-Aware)

Messages are classified by priority based on source/action, then QoS is adjusted based on network state:

| Network State | CRITICAL | HIGH | MEDIUM | LOW |
|---|---|---|---|---|
| **STABLE** | Base QoS, publish | Base QoS, publish | Base QoS, publish | Base QoS, publish |
| **DEGRADED** | QoS 2, publish | QoS 2, publish | QoS 1, publish | QoS 1, publish |
| **CRITICAL** | QoS 1, publish | **Buffer** | **Buffer** | **Buffer** |

Network state is set via `POST /api/network/state` (`STABLE` / `DEGRADED` / `CRITICAL`).

### 1.5 MQTT Buffer (Offline Resilience)

When a message can't be published (network CRITICAL + non-CRITICAL priority), it's stored in the `mqtt_buffer` SQLite table. On reconnect or manual flush (`POST /api/network/flush`), buffered messages are drained in priority order: CRITICAL → HIGH → MEDIUM → LOW.

### 1.6 Per-Person MQTT Users

During registration and check-in, a unique MQTT user is created per person via the **EMQX REST API v5**:
- Client ID: `sc-person-<personId>`
- Password: 32-char random hex
- Stored in `persons.mqtt_client_id` and `persons.mqtt_password`
- Used by `publishAsClient()` to publish person-specific events with their own credentials

---

## 2. Functions Using MQTT

| Service | MQTT Function | Purpose |
|---|---|---|
| `services/resource/register.js` | `publishAsClient()` | Publish `smartcamp/registration/new` |
| `services/resource/register.js` | `emqx.createMqttUser()` | Create per-person MQTT credentials |
| `services/resource/checkin.js` | `publishAsClient()` | Publish `smartcamp/registration/checkin` |
| `services/resource/checkin.js` | `emqx.createMqttUser()` | Ensure MQTT user exists |
| `services/resource/distribute.js` | `publishAsClient()` / `publish()` | Publish `smartcamp/distribution/log` |
| `services/resource/prediction.js` | `publish()` | Send forecast request via MQTT (HTTP fallback) |
| `services/resource/prediction.js` | `saamp.onMessage()` | Listen for forecast results |
| `services/resource/stats.js` | `saamp.getNetworkState()` | Read network state for dashboard |
| `services/network/network.js` | `saamp.flushBuffer()` | Flush buffered MQTT messages |
| `services/network/emqx-manager.js` | REST API calls | Create/update/delete/list EMQX users |

---

## 3. Key Files

| File | Role |
|---|---|
| `services/network/saamp-mqtt.js` | Core MQTT client: connect, publish, subscribe, buffer, adaptive QoS |
| `services/network/emqx-manager.js` | EMQX REST API user management |
| `services/network/network.js` | Network state facade |
| `services/network/connectivity.js` | Connectivity watcher |
| `config/constants.js` | All EMQX/DB configuration |
| `config/database.js` | SQLite schemas, mqtt_buffer |
| `server.js` | Bootstraps MQTT, routes |

---

## 4. Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `EMQX_HOST` | `i17140d1.ala.asia-southeast1.emqxsl.com` | MQTT broker host |
| `EMQX_PORT` | `8883` | MQTT TLS port |
| `EMQX_USERNAME` | `admin` | Broker username |
| `EMQX_PASSWORD` | `public` | Broker password |
| `EMQX_API_KEY` | *(empty)* | EMQX REST API key |
| `EMQX_API_SECRET` | *(empty)* | EMQX REST API secret |
| `EMQX_CA_CERT` | `./db/emqxsl-ca.crt` | CA certificate path |

---

## 5. Flow Diagram

```
[Server Boot]
  │
  ├── initializeCampDb()         → creates camp.db + pages.db schemas
  ├── mqttConnect()              → connects to EMQX (mqtts:8883)
  │     ├── subscribes to smartcamp/# (QoS 2)
  │     └── flushBuffer()        → drains any buffered messages
  ├── startConnectivityWatcher() → monitors connectivity
  └── setupMqttListener()        → registers forecast_result handler

[Registration]
  register.js → INSERT person → INSERT wristband
    → createMqttUser() → publishAsClient(smartcamp/registration/new)
    → if age < 18: INSERT pages_children

[Check-in]
  checkin.js → INSERT checkin → ensureMqttUser()
    → publishAsClient(smartcamp/registration/checkin)

[Distribution]
  distribute.js → INSERT distribution
    → publishAsClient(smartcamp/distribution/log)

[Prediction]
  prediction.js → Try HTTP first
    → If fail or CRITICAL: publish(smartcamp/prediction/forecast_request)
    → Cloud responds on smartcamp/prediction/forecast_result
    → Handler stores result in prediction_requests table

[Buffer]
  On publish failure or CRITICAL network:
    → INSERT mqtt_buffer → On reconnect: drain in priority order
```
