# Network State Prediction — Raspberry Pi

Predicts the camp uplink's condition (`STABLE` / `DEGRADED` / `CRITICAL`) from
live network measurements and pushes it into the Pi backend, where SAAMP uses
it to choose MQTT QoS and sync pacing.

This lives on the Pi rather than in the cloud because it measures *the Pi's own*
uplink and feeds a Pi-local endpoint. Nothing here talks to the cloud database.

## How it connects

```
network_monitor_service.py  (this directory, separate process)
    ping 8.8.8.8 ×5  +  TCP probe EMQX:8883
        │
        ▼  engineer_features() → RandomForest.predict()
    POST http://localhost:5000/api/network/state  {state, metrics}
        │
        ▼
  backend/controllers/network/network.js  setState()
        │
        ▼
  backend/services/network/saamp-mqtt.js  setNetworkState()
        │
        ├── decideAdaptiveQoS()  — QoS per message priority, buffer vs publish
        └── sync-manager         — cycle interval 5s / 15s / 60s
```

Without this process running, `predictedNetworkState` stays at its `'STABLE'`
default and every adaptive path in SAAMP is inert. It is not started by the Node
backend — run it yourself or install a service unit.

## Running

```bash
pip install -r requirements.txt

cd scripts
python3 network_monitor_service.py                      # measure + push, every 30s
python3 network_monitor_service.py --dry-run            # predict, don't push
python3 network_monitor_service.py --simulate DEGRADED  # force a profile
python3 network_monitor_service.py --interval 15 --backend http://localhost:5000
```

`network_simulator.py` shapes the real interface with `tc` (needs `sudo`) so the
model sees genuinely degraded conditions; `test_buffer_flow.sh` drives the full
loop — degrade the link, watch the state flip to CRITICAL, confirm messages land
in `mqtt_buffer` and flush in priority order on recovery.

## Retraining

```bash
cd src && python3 network_predictor.py      # writes models/network_*.pkl
```

Or open `notebooks/03_network_prediction_model.ipynb`, which compares several
classifiers and also trains the QoS model (see caveats).

## Caveats worth knowing

**The reported `accuracy: 1.0` is label leakage, not skill.** `label_network_state()`
defines the target as a threshold rule over `packet_loss`, `rtt_avg`,
`bridge_alive` and `queue_depth` — and all four are also input features. The
forest is re-learning a rule it was handed, so perfect accuracy is guaranteed and
says nothing about real-world performance. The model is a serviceable deployment
vehicle for that rule; it is not evidence the rule is correct.

**The QoS model is trained but never shipped.** `data_generator.py` builds a
genuinely non-trivial target — `optimal_qos`, the lowest QoS that still delivers —
plus `qos_delta` / `is_overprovisioned` / `is_underprovisioned` benchmarked
against the current SAAMP rules. Notebook cells 10–15 train and export
`qos_model.pkl`, but that artifact is not in `models/`, and
`network_monitor_service.py` only loads the state classifier. Real QoS decisions
are still made by the hand-written table in `saamp-mqtt.js`. That target has no
leakage, so it is the part that could actually beat the rules.

**Four features are synthesized, not measured.** At inference time
`collect_metrics()` derives `bandwidth`, `throughput`, `drop_rate` and
`queue_depth` from `rtt_avg` by fixed formulas, and hardcodes `clients` to 20.
In training these varied independently, so the model sees feature combinations in
production it never saw while training.

**Model artifacts are not in git.** `network_model.pkl`, `network_scaler.pkl` and
`network_features.pkl` are untracked, so a fresh clone cannot run inference until
someone retrains. They were pickled with scikit-learn 1.9.0 and emit an
`InconsistentVersionWarning` on older runtimes — pin the version or retrain on the
Pi's own scikit-learn.
