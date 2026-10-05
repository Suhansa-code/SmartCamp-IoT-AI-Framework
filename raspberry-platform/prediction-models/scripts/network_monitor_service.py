#!/usr/bin/env python3
"""Network state monitor for SAAMP.

Measures the link the Pi actually depends on, forecasts how it will look over
the next few minutes, and pushes that to the Node backend so SAAMP can raise
QoS and start buffering *before* messages are lost.

Two things distinguish it from a threshold check:
  * it forecasts a horizon, not the present moment, so there is lead time; and
  * it escalates on doubt (a probability band), not on the single most likely
    outcome, because missing an escalation is far worse than a false alarm.

Usage:
  python3 network_monitor_service.py
  python3 network_monitor_service.py --interval 15 --backend http://localhost:5000
  python3 network_monitor_service.py --dry-run
  python3 network_monitor_service.py --simulate CRITICAL
"""

import argparse
import datetime
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODELS_DIR = HERE.parent / 'models'
SRC_DIR = HERE.parent / 'src'
sys.path.insert(0, str(SRC_DIR))

EMQX_HOST = 'i17140d1.ala.asia-southeast1.emqxsl.com'
EMQX_PORT = 8883
PING_TARGET = '8.8.8.8'
INTERVAL = 30
BACKEND_URL = 'http://localhost:5000'
PING_COUNT = 5
BROKER_PROBES = 3
PRIORITIES = {0: 'LOW', 1: 'MEDIUM', 2: 'HIGH', 3: 'CRITICAL'}
SEVERITY = {'STABLE': 0, 'DEGRADED': 1, 'CRITICAL': 2}
BROKER_TIMEOUT = 2.0      # per connect attempt
BROKER_DEADLINE = 6.0     # total, so a dead broker cannot stall the cycle
UNREACHABLE_RTT = 4000.0


# ── Measurement ───────────────────────────────────────────────────────────

def measure_ping(host, count=PING_COUNT, timeout=20):
    """rtt_avg / rtt_max / packet_loss / jitter from ping."""
    try:
        r = subprocess.run(['ping', '-c', str(count), '-W', '3', host],
                           capture_output=True, text=True, timeout=timeout)
        out = r.stdout + r.stderr
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return {'rtt_avg': 999.0, 'rtt_max': 999.0, 'packet_loss': 100.0, 'jitter': 0.0}

    rtt_avg = rtt_max = 999.0
    jitter = 0.0
    packet_loss = 100.0

    m = re.search(r'(\d+(?:\.\d+)?)% packet loss', out)
    if m:
        packet_loss = float(m.group(1))
    m = re.search(r'rtt min/avg/max/mdev = [\d.]+/([\d.]+)/([\d.]+)/([\d.]+)', out)
    if m:
        rtt_avg, rtt_max, jitter = float(m.group(1)), float(m.group(2)), float(m.group(3))

    return {'rtt_avg': rtt_avg, 'rtt_max': rtt_max,
            'packet_loss': packet_loss, 'jitter': jitter}


def probe_broker(host=EMQX_HOST, port=EMQX_PORT, probes=BROKER_PROBES,
                 timeout=BROKER_TIMEOUT, deadline=BROKER_DEADLINE):
    """TCP connect latency to the broker.

    The path that matters is the one to EMQX, not to Google. A ping to 8.8.8.8
    says the internet works; it says nothing about whether the broker is
    reachable or how far away it currently feels.

    Deliberately not socket.create_connection: that walks every address
    getaddrinfo returns (v4 and v6, several A records) giving each the full
    timeout, so an unreachable broker took ~48s for three probes — far longer
    than the monitor's own interval, and only when the broker is down, which is
    exactly when the reading is needed on time. Resolve once, then bound both
    the per-attempt timeout and the total.
    """
    started = time.perf_counter()
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except OSError:
        return {'broker_rtt': UNREACHABLE_RTT, 'bridge_alive': False}
    if not infos:
        return {'broker_rtt': UNREACHABLE_RTT, 'bridge_alive': False}

    family, socktype, proto, _, sockaddr = infos[0]
    samples = []

    for _ in range(probes):
        if time.perf_counter() - started > deadline:
            break
        s = socket.socket(family, socktype, proto)
        s.settimeout(timeout)
        start = time.perf_counter()
        try:
            s.connect(sockaddr)
            samples.append((time.perf_counter() - start) * 1000.0)
        except OSError:
            pass
        finally:
            s.close()

    if not samples:
        return {'broker_rtt': UNREACHABLE_RTT, 'bridge_alive': False}
    return {'broker_rtt': sum(samples) / len(samples), 'bridge_alive': True}


def fetch_queue_depth(backend_url, timeout=3):
    """Real buffered-message count from the backend.

    Previously this was invented as rtt_avg/5, which made it a restatement of
    latency rather than evidence. The true depth is a genuine, independent
    signal: a queue that is growing means SAAMP is already struggling.
    """
    try:
        with urllib.request.urlopen(f'{backend_url}/api/network/status', timeout=timeout) as r:
            return int(json.loads(r.read()).get('buffered_messages', 0))
    except (urllib.error.URLError, ValueError, KeyError, TimeoutError):
        return None


def collect_metrics(history, backend_url):
    ping = measure_ping(PING_TARGET)
    broker = probe_broker()
    now = datetime.datetime.now()

    depth = fetch_queue_depth(backend_url)
    if depth is None:
        depth = history[-1]['queue_depth'] if history else 0

    metrics = {
        **ping, **broker,
        'hour': float(now.hour),
        'day_of_week': float(now.weekday()),
        'queue_depth': depth,
    }
    metrics['queue_delta'] = depth - history[-1]['queue_depth'] if history else 0

    # An internet path that is fine while the broker is unreachable is a
    # broker-side fault, not a degraded uplink — worth saying out loud.
    if not broker['bridge_alive'] and ping['packet_loss'] < 5:
        print('[monitor] broker unreachable but internet path is healthy — broker-side fault')

    return metrics


# ── Model ─────────────────────────────────────────────────────────────────

def load_qos_model():
    """Optional — SAAMP falls back to its rule table when this is absent."""
    import joblib
    try:
        return (joblib.load(MODELS_DIR / 'qos_model.pkl'),
                joblib.load(MODELS_DIR / 'qos_scaler.pkl'),
                joblib.load(MODELS_DIR / 'qos_features.pkl'))
    except FileNotFoundError:
        return None, None, None


def load_model():
    import joblib
    model = joblib.load(MODELS_DIR / 'network_model.pkl')
    scaler = joblib.load(MODELS_DIR / 'network_scaler.pkl')
    features = joblib.load(MODELS_DIR / 'network_features.pkl')

    meta_path = MODELS_DIR / 'network_model_meta.json'
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    thresholds = meta.get('thresholds', {})

    # Overridable without retraining, because the trained default trades away
    # something the sweep does not measure. At t_critical=0.25 the model reaches
    # its best escalation recall (0.49) but P(CRITICAL) sits near 0.3 for almost
    # any non-pristine link, so DEGRADED is effectively unreachable and SAAMP
    # collapses to two states — its QoS-upgrade path never runs. t_critical=0.5
    # restores three usable states at lower recall (0.33) and far fewer false
    # alarms (2.4% vs 12.3%). Which is right depends on whether you would rather
    # buffer early or use the graduated response.
    return model, scaler, features, {
        't_critical': float(os.environ.get('NETWORK_T_CRITICAL',
                                           thresholds.get('t_critical', 0.25))),
        't_degraded': float(os.environ.get('NETWORK_T_DEGRADED',
                                           thresholds.get('t_degraded', 0.25))),
        'horizon': meta.get('horizon_samples', 10),
    }


def observed_safety_state(metrics):
    """An explainable, fail-safe floor based on the latest real observation.

    A forecast is useful for starting protection early, but it must never make
    the Pi call a known broker outage or severe loss "healthy". These limits
    deliberately mirror the delivery risks rather than trying to replace the
    model: the model supplies lead time, this supplies immediate certainty.
    """
    if (not metrics.get('bridge_alive', False)
            or metrics.get('packet_loss', 0) >= 15
            or metrics.get('rtt_avg', 0) >= 1000
            or metrics.get('queue_depth', 0) >= 100):
        return 'CRITICAL'
    if (metrics.get('packet_loss', 0) >= 5
            or metrics.get('rtt_avg', 0) >= 300
            or metrics.get('jitter', 0) >= 30
            or metrics.get('broker_rtt', 0) >= 400
            or metrics.get('queue_depth', 0) >= 50):
        return 'DEGRADED'
    return 'STABLE'


def predict_state(history, model, scaler, features, thresholds):
    """Forecast from recent history, with a real-observation safety floor."""
    import pandas as pd
    from feature_extraction import engineer_features
    from network_predictor import INV_STATE_MAP, decide_state

    df = engineer_features(pd.DataFrame(history))
    for col in features:
        if col not in df.columns:
            df[col] = 0.0

    X = df[features].fillna(0).iloc[[-1]]
    proba = model.predict_proba(scaler.transform(X))[0]
    classes = [INV_STATE_MAP[c] for c in model.classes_]

    forecast_state = decide_state(
        proba, classes, thresholds['t_critical'], thresholds['t_degraded']
    )
    observed_state = observed_safety_state(history[-1])
    state = max((forecast_state, observed_state), key=lambda s: SEVERITY[s])
    decision = {
        'forecast_state': forecast_state,
        'observed_state': observed_state,
        'source': 'safety_floor' if SEVERITY[observed_state] > SEVERITY[forecast_state]
                  else 'forecast',
    }
    return state, {c: round(float(p), 3) for c, p in zip(classes, proba)}, decision


def predict_qos_policy(history, qos_model, qos_scaler, qos_features):
    """QoS for each priority under current conditions.

    Network metrics are identical for every message at a given moment, so the
    whole policy is four predictions per cycle rather than one per message —
    no Python in the publish path, and nothing breaks when this process dies.
    """
    import pandas as pd
    from feature_extraction import engineer_features

    df = engineer_features(pd.DataFrame(history))
    policy = {}

    for code, name in PRIORITIES.items():
        row = df.iloc[[-1]].copy()
        row['priority_scaled'] = code / 3.0
        for col in qos_features:
            if col not in row.columns:
                row[col] = 0.0
        X = row[qos_features].fillna(0)
        policy[name] = int(qos_model.predict(qos_scaler.transform(X))[0])

    return policy


# ── Backend ───────────────────────────────────────────────────────────────

def push_state(state, metrics, probabilities, decision, qos_policy, backend_url):
    payload = {
        'state': state,
        'metrics': {
            'rtt_avg': round(metrics.get('rtt_avg', 0), 1),
            'rtt_max': round(metrics.get('rtt_max', 0), 1),
            'packet_loss': round(metrics.get('packet_loss', 0), 2),
            'jitter': round(metrics.get('jitter', 0), 1),
            'broker_rtt': round(metrics.get('broker_rtt', 0), 1),
            'bridge_alive': metrics.get('bridge_alive', False),
            'queue_depth': metrics.get('queue_depth', 0),
            'probabilities': probabilities,
            'decision': decision,
        },
        'qos_policy': qos_policy,
    }
    req = urllib.request.Request(
        f'{backend_url}/api/network/state',
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except urllib.error.URLError as e:
        print(f'[monitor] push failed: {e.reason}')
        return False


SIMULATED_PROFILES = {
    'STABLE':   {'rtt_avg': 40.0, 'rtt_max': 55.0, 'packet_loss': 0.1, 'jitter': 3.0,
                 'broker_rtt': 30.0, 'bridge_alive': True, 'queue_depth': 2},
    'DEGRADED': {'rtt_avg': 420.0, 'rtt_max': 650.0, 'packet_loss': 7.0, 'jitter': 55.0,
                 'broker_rtt': 500.0, 'bridge_alive': True, 'queue_depth': 60},
    'CRITICAL': {'rtt_avg': 1400.0, 'rtt_max': 2200.0, 'packet_loss': 25.0, 'jitter': 180.0,
                 'broker_rtt': UNREACHABLE_RTT, 'bridge_alive': False, 'queue_depth': 150},
}


def run(interval=INTERVAL, backend_url=BACKEND_URL, dry_run=False, simulate=None):
    print(f'[monitor] Loading model from {MODELS_DIR}')
    model, scaler, features, thresholds = load_model()
    qos_model, qos_scaler, qos_features = load_qos_model()
    print(f'[monitor] Model loaded ({len(features)} features, horizon '
          f'{thresholds["horizon"]} samples)')
    print(f'[monitor] Escalate at P(CRITICAL)>={thresholds["t_critical"]}, '
          f'P(not stable)>={thresholds["t_degraded"]}')
    print('[monitor] QoS: ' + ('model-driven' if qos_model
                               else 'no qos_model.pkl — SAAMP uses its rule table'))
    if simulate:
        print(f'[monitor] SIMULATION mode: forcing {simulate}')
    else:
        print(f'[monitor] Measuring every {interval}s → {backend_url}')
    if dry_run:
        print('[monitor] DRY-RUN: predictions printed but not pushed')

    history = []
    while True:
        ts = datetime.datetime.now().strftime('%H:%M:%S')
        try:
            if simulate:
                now = datetime.datetime.now()
                metrics = {**SIMULATED_PROFILES[simulate],
                           'hour': float(now.hour),
                           'day_of_week': float(now.weekday()),
                           'queue_delta': 0}
            else:
                metrics = collect_metrics(history, backend_url)

            history.append(metrics)
            if len(history) > 120:
                history.pop(0)

            state, probabilities, decision = predict_state(
                history, model, scaler, features, thresholds
            )

            qos_policy = None
            if qos_model is not None:
                qos_policy = predict_qos_policy(history, qos_model, qos_scaler, qos_features)

            brok = 'up' if metrics['bridge_alive'] else 'DOWN'
            tag = ' [SIMULATED]' if simulate else ''
            print(f'[monitor] {ts}  RTT={metrics["rtt_avg"]:.0f}ms  '
                  f'loss={metrics["packet_loss"]:.1f}%  broker={brok} '
                  f'({metrics["broker_rtt"]:.0f}ms)  q={metrics["queue_depth"]}  '
                  f'→ {state} ({decision["source"]}) {probabilities}{tag}')
            if qos_policy:
                print(f'[monitor] {ts}  QoS policy {qos_policy}')

            if not dry_run:
                ok = push_state(state, metrics, probabilities, decision, qos_policy, backend_url)
                print(f'[monitor] {ts}  State {state} {"pushed" if ok else "PUSH FAILED"}')

        except Exception as e:
            print(f'[monitor] {ts}  ERROR: {e}')

        time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description='SAAMP network state monitor')
    parser.add_argument('--interval', type=int, default=INTERVAL)
    parser.add_argument('--backend', default=BACKEND_URL)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--simulate', choices=['STABLE', 'DEGRADED', 'CRITICAL'], default=None)
    args = parser.parse_args()
    run(interval=args.interval, backend_url=args.backend,
        dry_run=args.dry_run, simulate=args.simulate)


if __name__ == '__main__':
    main()
