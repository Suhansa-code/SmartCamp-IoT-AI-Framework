# Network monitoring data flow

This note maps the Raspberry Pi network monitor to the operator screen. It is
based on the current source files; it does not describe a new deployment.

## Components

1. `raspberry-platform/prediction-models/scripts/network_monitor_service.py`
   measures ping latency, packet loss, jitter, broker reachability, and the
   message buffer depth. It predicts a network state from recent samples.
2. The monitor sends a `POST /api/network/state` request to the Raspberry Pi
   backend with `state`, `metrics`, and an optional `qos_policy`.
3. `raspberry-platform/backend/services/network/network.js` stores the latest
   metrics in memory, applies the state to SAAMP, and retains at most 120 status
   samples for the operator view. The MQTT message buffer is a separate store.
4. `GET /api/network/status` returns the latest state, metrics, update time,
   buffered-message count, diagnostics, reachability, and recent history.
   `GET /api/network/stream` sends the same status as `network` server-sent
   events and keeps the connection alive with comments.
5. `raspberry-platform/frontend/src/components/resources/NetworkScreen.jsx`
   requests the initial status and listens for the `network` event. The screen
   is intended to keep a polling fallback when the event stream is unavailable.

## Status contract

| Field | Operator meaning |
| --- | --- |
| `state` | Current `STABLE`, `DEGRADED`, or `CRITICAL` network state. |
| `metrics` | Latest measurements supplied by the monitor. |
| `updated_at` | Time when the backend last accepted a state update. |
| `buffered_messages` | MQTT messages still waiting to be flushed. |
| `diagnostics` | Effective state and QoS decision details from SAAMP. |
| `history` | Recent state and metric samples held in memory for the screen. |

## Operational checks

- Start the Raspberry Pi backend before the monitor. The monitor reads
  `/api/network/status` to get queue depth and posts results to
  `/api/network/state`.
- Use `python3 raspberry-platform/prediction-models/scripts/network_monitor_service.py --dry-run`
  to inspect predictions without posting state to the backend.
- Confirm that `/api/network/status` has a recent `updated_at` value and that
  the `history` array grows when the monitor runs.
- If the browser view is stale, compare the JSON status endpoint with the
  `network` events from `/api/network/stream`. This separates backend updates
  from browser subscription issues.

The route and response contract are defined in
`raspberry-platform/backend/routes/network/network.js` and
`raspberry-platform/backend/services/network/network.js`.
