#!/usr/bin/env python3
"""
Network QoS Monitor Service
Measures real network metrics, runs the trained Random Forest model,
and pushes the predicted state (STABLE/DEGRADED/CRITICAL) to the
Node.js backend via POST /api/network/state every INTERVAL seconds.

Usage:
  python3 network_monitor_service.py
  python3 network_monitor_service.py --interval 15 --backend http://localhost:5000
  python3 network_monitor_service.py --dry-run       # print predictions without pushing
"""

import argparse
import datetime
import json
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────
HERE = Path(__file__).resolve().parent
MODELS_DIR = HERE.parent / 'models'
SRC_DIR = HERE.parent / 'src'
sys.path.insert(0, str(SRC_DIR))

# ── Config ─────────────────────────────────────────────────────
EMQX_HOST   = 'i17140d1.ala.asia-southeast1.emqxsl.com'
PING_TARGET = '8.8.8.8'
INTERVAL    = 30        # seconds between predictions
BACKEND_URL = 'http://localhost:5000'
PING_COUNT  = 5


# ── Network measurement ────────────────────────────────────────

def measure_ping(host, count=PING_COUNT, timeout=20):
    """Return rtt_avg, rtt_max, packet_loss, jitter via ping."""
    try:
        r = subprocess.run(
            ['ping', '-c', str(count), '-W', '3', host],
            capture_output=True, text=True, timeout=timeout
        )
        out = r.stdout + r.stderr
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return {'rtt_avg': 999.0, 'rtt_max': 999.0,
                'packet_loss': 100.0, 'jitter': 0.0}

    rtt_avg, rtt_max, jitter = 999.0, 999.0, 0.0
    packet_loss = 100.0

    m = re.search(r'(\d+(?:\.\d+)?)% packet loss', out)
    if m:
        packet_loss = float(m.group(1))

    m = re.search(r'rtt min/avg/max/mdev = [\d.]+/([\d.]+)/([\d.]+)/([\d.]+)', out)
    if m:
        rtt_avg = float(m.group(1))
        rtt_max = float(m.group(2))
        jitter  = float(m.group(3))

    return {'rtt_avg': rtt_avg, 'rtt_max': rtt_max,
            'packet_loss': packet_loss, 'jitter': jitter}


def check_broker_alive(host=EMQX_HOST, port=8883, timeout=4):
    """TCP reachability check for the MQTT broker."""
    try:
        import socket
        s = socket.create_connection((host, port), timeout=timeout)
        s.close()
        return True
    except OSError:
        return False


def collect_metrics(history: list) -> dict:
    """
    Measure current network metrics and derive features needed by the model.
    history is a list of past metric dicts used for queue_delta / throughput.
    """
    ping = measure_ping(PING_TARGET)
    broker = check_broker_alive()

    now = datetime.datetime.now()
    metrics = {
        'rtt_avg':      ping['rtt_avg'],
        'rtt_max':      ping['rtt_max'],
        'packet_loss':  ping['packet_loss'],
        'jitter':       ping['jitter'],
        'bridge_alive': broker,
        'hour':         float(now.hour),
        'day_of_week':  float(now.weekday()),
        # Derived / estimated
        'bandwidth':    max(0.5, 50.0 - ping['rtt_avg'] * 0.05),
        'throughput':   max(0.0, 200.0 - ping['rtt_avg'] * 0.3),
        'drop_rate':    ping['packet_loss'] * 0.5,
        'clients':      20,
        'queue_depth':  int(min(200, ping['rtt_avg'] / 5)),
    }

    # queue_delta from previous sample
    if history:
        prev_depth = history[-1].get('queue_depth', metrics['queue_depth'])
        metrics['queue_delta'] = metrics['queue_depth'] - prev_depth
    else:
        metrics['queue_delta'] = 0

    history.append(metrics)
    if len(history) > 120:
        history.pop(0)

    return metrics


# ── Model prediction ───────────────────────────────────────────

def load_model():
    """Load the trained Random Forest + scaler from disk."""
    import joblib
    model   = joblib.load(MODELS_DIR / 'network_model.pkl')
    scaler  = joblib.load(MODELS_DIR / 'network_scaler.pkl')
    features = joblib.load(MODELS_DIR / 'network_features.pkl')
    return model, scaler, features


def predict_state(metrics: dict, model, scaler, features, priority=1) -> str:
    """
    Run the trained model on live metrics.
    priority: 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL (default MEDIUM for monitoring)
    """
    import pandas as pd
    from feature_extraction import engineer_features

    row = {**metrics, 'priority': priority}
    df = pd.DataFrame([row])
    df_feat = engineer_features(df)

    # Fill any missing engineered columns with 0
    for col in features:
        if col not in df_feat.columns:
            df_feat[col] = 0.0

    X = df_feat[features].fillna(0)
    X_sc = scaler.transform(X)
    pred = model.predict(X_sc)[0]
    inv_map = {0: 'STABLE', 1: 'DEGRADED', 2: 'CRITICAL'}
    return inv_map.get(int(pred), 'STABLE')


# ── Push to backend ────────────────────────────────────────────

def push_state(state: str, metrics: dict, backend_url: str) -> bool:
    """POST predicted network state + metrics to the Node.js backend."""
    url  = f'{backend_url}/api/network/state'
    payload = {
        'state': state,
        'metrics': {
            'rtt_avg':      round(metrics.get('rtt_avg', 0), 1),
            'rtt_max':      round(metrics.get('rtt_max', 0), 1),
            'packet_loss':  round(metrics.get('packet_loss', 0), 2),
            'jitter':       round(metrics.get('jitter', 0), 1),
            'bandwidth':    round(metrics.get('bandwidth', 0), 1),
            'bridge_alive': metrics.get('bridge_alive', False),
            'queue_depth':  metrics.get('queue_depth', 0),
        },
    }
    body = json.dumps(payload).encode()
    req  = urllib.request.Request(
        url, data=body,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except urllib.error.URLError as e:
        print(f'[monitor] push failed: {e.reason}')
        return False


# ── Main loop ──────────────────────────────────────────────────

SIMULATED_PROFILES = {
    'STABLE':   {'rtt_avg': 40.0,   'rtt_max': 55.0,  'packet_loss': 0.1, 'jitter': 3.0,
                 'queue_depth': 10, 'bandwidth': 48.0, 'throughput': 185.0, 'drop_rate': 0.1,
                 'bridge_alive': True, 'clients': 25, 'queue_delta': 0},
    'DEGRADED': {'rtt_avg': 420.0,  'rtt_max': 650.0, 'packet_loss': 7.0, 'jitter': 55.0,
                 'queue_depth': 60, 'bandwidth': 3.0,  'throughput': 25.0, 'drop_rate': 4.0,
                 'bridge_alive': True, 'clients': 35, 'queue_delta': 5},
    'CRITICAL': {'rtt_avg': 1400.0, 'rtt_max': 2200.0,'packet_loss': 25.0,'jitter': 180.0,
                 'queue_depth': 120,'bandwidth': 0.4,  'throughput': 3.0,  'drop_rate': 15.0,
                 'bridge_alive': False,'clients': 8, 'queue_delta': 12},
}


def run(interval=INTERVAL, backend_url=BACKEND_URL, dry_run=False, simulate=None):
    print(f'[monitor] Loading model from {MODELS_DIR}')
    model, scaler, features = load_model()
    print(f'[monitor] Model loaded ({len(features)} features)')
    if simulate:
        print(f'[monitor] SIMULATION mode: forcing {simulate} network profile')
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
                           'day_of_week': float(now.weekday())}
                history.append(metrics)
            else:
                metrics = collect_metrics(history)

            state = predict_state(metrics, model, scaler, features)

            rtt  = metrics['rtt_avg']
            loss = metrics['packet_loss']
            brok = 'up' if metrics['bridge_alive'] else 'DOWN'
            tag  = ' [SIMULATED]' if simulate else ''
            print(f'[monitor] {ts}  RTT={rtt:.0f}ms  loss={loss:.1f}%  broker={brok}  → {state}{tag}')

            if not dry_run:
                ok = push_state(state, metrics, backend_url)
                status = 'pushed' if ok else 'PUSH FAILED'
                print(f'[monitor] {ts}  State {state} {status}')

        except Exception as e:
            print(f'[monitor] {ts}  ERROR: {e}')

        time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description='Network QoS Monitor Service')
    parser.add_argument('--interval', type=int, default=INTERVAL,
                        help=f'Seconds between measurements (default: {INTERVAL})')
    parser.add_argument('--backend', default=BACKEND_URL,
                        help=f'Backend base URL (default: {BACKEND_URL})')
    parser.add_argument('--dry-run', action='store_true',
                        help='Print predictions without pushing to backend')
    parser.add_argument('--simulate', choices=['STABLE', 'DEGRADED', 'CRITICAL'],
                        default=None,
                        help='Skip real ping; inject a fixed network profile for testing')
    args = parser.parse_args()
    run(interval=args.interval, backend_url=args.backend,
        dry_run=args.dry_run, simulate=args.simulate)


if __name__ == '__main__':
    main()
