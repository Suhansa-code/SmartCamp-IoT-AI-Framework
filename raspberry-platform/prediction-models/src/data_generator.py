import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta

DATA_DIR = Path(__file__).resolve().parent.parent / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42
np.random.seed(RANDOM_STATE)


def _generate_segment(n, state, rng):
    """Generate n rows for a given network state (STABLE/DEGRADED/CRITICAL)."""
    timestamps = pd.date_range('2024-06-01', periods=n, freq='30s')
    hour = np.asarray(timestamps.hour, dtype=float)
    day_of_week = np.asarray(timestamps.dayofweek, dtype=float)

    peak_signal = (
        0.3 * np.sin(2 * np.pi * (hour - 6) / 24) ** 2
        + 0.7 * np.sin(2 * np.pi * (hour - 18) / 24) ** 2
    )

    if state == 'STABLE':
        rtt_base = 20 + 80 * (1 - peak_signal)
        data = {
            'rtt_avg':     (rtt_base + rng.exponential(10, n)).clip(5, 290),
            'packet_loss': (0.1 * (1 - peak_signal) + rng.exponential(0.3, n)).clip(0, 4.9),
            'jitter':      (2 + 10 * (1 - peak_signal) + rng.exponential(3, n)).clip(0, 30),
            'queue_depth': rng.poisson(5 + 25 * peak_signal, n),
            'throughput':  (80 + 200 * peak_signal + rng.normal(0, 20, n)).clip(30, 500),
            'bandwidth':   (5 + 45 * peak_signal + rng.normal(0, 5, n)).clip(1, 100),
            'drop_rate':   (0.05 * (1 - peak_signal) + rng.exponential(0.1, n)).clip(0, 1.9),
            'bridge_alive': rng.choice([True, False], n, p=[0.99, 0.01]),
            'clients':     rng.poisson(15 + 30 * peak_signal, n).clip(3, 80),
        }
    elif state == 'DEGRADED':
        rtt_base = 300 + 400 * (1 - peak_signal)
        data = {
            'rtt_avg':     (rtt_base + rng.exponential(60, n)).clip(300, 999),
            'packet_loss': (5 + rng.exponential(3, n)).clip(5, 14.9),
            'jitter':      (30 + rng.exponential(20, n)).clip(20, 150),
            'queue_depth': rng.poisson(40 + 60 * peak_signal, n).clip(10, 99),
            'throughput':  (10 + 40 * peak_signal + rng.normal(0, 10, n)).clip(1, 80),
            'bandwidth':   (0.5 + 5 * peak_signal + rng.normal(0, 1, n)).clip(0.5, 10),
            'drop_rate':   (2 + rng.exponential(1.5, n)).clip(2, 9.9),
            'bridge_alive': rng.choice([True, False], n, p=[0.95, 0.05]),
            'clients':     rng.poisson(20 + 40 * peak_signal, n).clip(5, 80),
        }
    else:  # CRITICAL
        rtt_base = 1000 + 500 * (1 - peak_signal)
        data = {
            'rtt_avg':     (rtt_base + rng.exponential(200, n)).clip(1000, 3000),
            'packet_loss': (15 + rng.exponential(10, n)).clip(15, 100),
            'jitter':      (100 + rng.exponential(50, n)).clip(50, 500),
            'queue_depth': rng.poisson(80 + 50 * peak_signal, n).clip(50, 200),
            'throughput':  (rng.exponential(5, n)).clip(0, 20),
            'bandwidth':   (rng.exponential(0.5, n)).clip(0.1, 2),
            'drop_rate':   (10 + rng.exponential(5, n)).clip(10, 50),
            'bridge_alive': rng.choice([True, False], n, p=[0.60, 0.40]),
            'clients':     rng.poisson(5 + 10 * peak_signal, n).clip(0, 30),
        }

    seg = pd.DataFrame(data)
    seg['timestamp'] = timestamps
    seg['hour'] = hour
    seg['day_of_week'] = day_of_week
    seg['rtt_max'] = (seg['rtt_avg'] + seg['jitter'] * 2).clip(5, 5000)
    seg['queue_delta'] = rng.integers(-10, 15, n)
    return seg


def generate_synthetic_dataset(n_samples=10000, save=True):
    """
    Generates a labelled dataset for QoS adaptation modelling.

    Each row = a message-send event at a point in time with current
    network conditions, the QoS that was used, and the outcome.

    Features (network metrics at publish time, matching NetworkMonitor):
      - rtt_avg, rtt_max, packet_loss, jitter, queue_depth,
        throughput, bandwidth, drop_rate, bridge_alive, clients,
        hour_of_day

    Features (message semantics):
      - priority_encoded: 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL

    Label / target (*multiple possible*):
      - optimal_qos:      the QoS level (0/1/2) that would have been
                          the best trade-off between reliability and overhead
      - delivery_success: 1 if the message was delivered, 0 otherwise
      - broker_rejected:  1 if broker refused the message, 0 otherwise

    Class distribution: 65% STABLE, 20% DEGRADED, 15% CRITICAL
    (previously the generator never produced enough DEGRADED samples)
    """
    rng = np.random.default_rng(RANDOM_STATE)

    n_stable   = int(n_samples * 0.65)
    n_degraded = int(n_samples * 0.20)
    n_critical = n_samples - n_stable - n_degraded

    seg_stable   = _generate_segment(n_stable,   'STABLE',   rng)
    seg_degraded = _generate_segment(n_degraded, 'DEGRADED', rng)
    seg_critical = _generate_segment(n_critical, 'CRITICAL', rng)

    df = pd.concat([seg_stable, seg_degraded, seg_critical], ignore_index=True)
    df = df.sample(frac=1, random_state=RANDOM_STATE).reset_index(drop=True)

    # ---- Message semantic features ---------------------------------------
    # Priorities matching saampMqtt.js: LOW=0, MEDIUM=1, HIGH=2, CRITICAL=3
    priorities = rng.choice([0, 1, 2, 3], n_samples, p=[0.15, 0.30, 0.25, 0.30])

    # Base QoS for each priority (matching classifyMessage in saampMqtt.js)
    base_qos_map = {0: 0, 1: 1, 2: 1, 3: 2}
    base_qos = np.array([base_qos_map[p] for p in priorities])

    df['priority']     = priorities  # 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL
    df['base_qos']     = base_qos
    df['priority_label'] = df['priority'].map({
        0: 'LOW', 1: 'MEDIUM', 2: 'HIGH', 3: 'CRITICAL'
    })

    # ---- Simulate outcome for each QoS level ------------------------------
    # For each message, simulate what WOULD happen at QoS 0, 1, and 2.
    # This lets us label "optimal_qos" — the lowest QoS that still succeeds.

    def simulate_outcome(qos_level, row):
        """Probability of delivery success given network conditions + QoS."""
        net_ok = (
            row['packet_loss'] < 5
            and row['rtt_avg'] < 300
            and row['queue_depth'] < 100
            and row['drop_rate'] < 2
            and row['bridge_alive']
        )
        net_bad = (
            row['packet_loss'] >= 15
            or row['rtt_avg'] >= 1000
            or not row['bridge_alive']
        )

        if not row['bridge_alive']:
            return 0.0

        if net_ok:
            base_p = {0: 0.70, 1: 0.95, 2: 0.99}
        elif net_bad:
            base_p = {0: 0.10, 1: 0.30, 2: 0.60}
        else:
            base_p = {0: 0.40, 1: 0.75, 2: 0.90}

        return base_p.get(qos_level, 0.50)

    outcomes = []
    for _, row in df.iterrows():
        for qos in [0, 1, 2]:
            prob = simulate_outcome(qos, row)
            success = int(rng.random() < prob)
            outcomes.append({
                'index': row.name,
                'qos_tested': qos,
                'delivery_success': success,
                'broker_rejected': int(not success and rng.random() < 0.3),
            })

    out_df = pd.DataFrame(outcomes)

    # ---- Determine optimal QoS per message --------------------------------
    # optimal_qos = lowest QoS that gives delivery_success == 1
    # If all fail, optimal_qos = -1 (should buffer / don't send)
    def pick_optimal(group):
        successes = group[group['delivery_success'] == 1]
        if successes.empty:
            return -1
        return successes['qos_tested'].min()

    optimal = out_df.groupby('index').apply(pick_optimal, include_groups=False).reset_index()
    optimal.columns = ['index', 'optimal_qos']
    df['optimal_qos'] = optimal['optimal_qos'].values

    # ---- The QoS that current SAAMP rule-based system would choose --------
    # (for comparison / as a baseline feature)
    def current_saamp_qos(row):
        if row['priority'] == 3:  # CRITICAL
            return 2
        if row['packet_loss'] > 10 or row['rtt_avg'] > 500:
            return 1 if row['priority'] >= 2 else 0
        if row['packet_loss'] > 5 or row['rtt_avg'] > 200:
            return row['base_qos']
        return row['base_qos']

    df['saamp_qos'] = df.apply(current_saamp_qos, axis=1)

    # ---- Was the message over- or under-provisioned? ----------------------
    df['qos_delta'] = df['saamp_qos'] - df['optimal_qos']
    # Positive = over-provisioned using too high QoS (wasteful)
    # Negative = under-provisioned (risked delivery failure)

    df['is_overprovisioned']  = (df['qos_delta'] > 0).astype(int)
    df['is_underprovisioned'] = (df['qos_delta'] < 0).astype(int)

    if save:
        path = DATA_DIR / 'network_qos_dataset.csv'
        df.to_csv(path, index=False)
        print(f"Saved {len(df)} rows → {path}")

        # Also save a smaller sample for fast experimentation
        sample = df.sample(min(2000, n_samples), random_state=RANDOM_STATE)
        path_sample = DATA_DIR / 'network_qos_dataset_sample.csv'
        sample.to_csv(path_sample, index=False)
        print(f"Saved {len(sample)} rows → {path_sample}")

    return df


def describe_dataset(df):
    print(f"Shape: {df.shape}")
    print(f"\nTarget distribution (optimal_qos):")
    print(df['optimal_qos'].value_counts().sort_index())
    print(f"\nFeature columns ({len(df.select_dtypes('number').columns)}):")
    print(list(df.select_dtypes('number').columns))
    print(f"\nOptimal QoS by priority:")
    print(df.groupby('priority_label')['optimal_qos'].value_counts().unstack(fill_value=0))
    print(f"\nOver-provisioned:  {df['is_overprovisioned'].sum()}")
    print(f"Under-provisioned: {df['is_underprovisioned'].sum()}")
    print(f"Optimal choices:   {(df['qos_delta'] == 0).sum()}")


if __name__ == '__main__':
    df = generate_synthetic_dataset(20000)
    describe_dataset(df)
