import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta

DATA_DIR = Path(__file__).resolve().parent.parent / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42
np.random.seed(RANDOM_STATE)


# ── Latent-stress time series ─────────────────────────────────────────────
#
# The old generator drew three independent clouds of points and shuffled them,
# so consecutive rows were unrelated. That is fine for classifying the *current*
# state, but it makes predicting the *next* state impossible in principle —
# there is nothing to extrapolate from.
#
# Instead we evolve a latent "stress" level with momentum (AR(1)) plus
# occasional shocks. Every metric is a function of stress, so degradation ramps
# in and out the way a real link does, and a model can learn to see it coming.

PHI = 0.93                  # stress momentum; higher = slower, smoother drift
SHOCK_PROB_BASE = 0.0015    # failure hazard on a healthy link
SHOCK_STRESS_GAIN = 12.0    # ...rising sharply as the link is already strained
SHOCK_SIZE = (0.35, 0.75)   # total stress a shock eventually adds
SHOCK_RAMP = (3, 6)         # samples the shock takes to build
RECOVERY_PROB = 0.02        # chance per sample of a step recovery

# How far ahead the model forecasts, in samples. At the monitor's 30s cadence
# 10 samples is ~5 minutes — enough lead time for SAAMP to start buffering
# before the link fails, which one sample (30s) is not.
HORIZON = 10


def _diurnal_pressure(hour):
    """Baseline stress by time of day — busy in the morning and evening."""
    return (
        0.30 * np.sin(2 * np.pi * (hour - 6) / 24) ** 2
        + 0.55 * np.sin(2 * np.pi * (hour - 18) / 24) ** 2
    )


def _simulate_stress(n, hours, rng):
    """Latent link stress over time.

    Two properties make this forecastable at all, and both are true of real
    links: failures are more likely when the link is *already* strained, and
    they build over a handful of samples rather than appearing from nowhere.
    An unheralded instantaneous shock is white noise — no model can see it
    coming, and a simulator full of them just teaches the model to give up.
    """
    stress = np.zeros(n)
    s = 0.15
    ramp_remaining = 0
    ramp_step = 0.0

    for t in range(n):
        target = _diurnal_pressure(hours[t]) * 0.6
        s = PHI * s + (1 - PHI) * target + rng.normal(0, 0.02)

        if ramp_remaining > 0:
            s += ramp_step
            ramp_remaining -= 1
        else:
            hazard = SHOCK_PROB_BASE * (1.0 + SHOCK_STRESS_GAIN * s)
            if rng.random() < hazard:
                length = int(rng.integers(*SHOCK_RAMP))
                ramp_step = rng.uniform(*SHOCK_SIZE) / length
                ramp_remaining = length
            elif rng.random() < RECOVERY_PROB:
                s *= 0.5

        s = float(np.clip(s, 0.0, 1.0))
        stress[t] = s
    return stress


def _metrics_from_stress(stress, rng):
    """Map latent stress onto the metrics the Pi can actually measure."""
    n = len(stress)

    rtt_avg = 18 + 2600 * stress ** 3 + rng.exponential(8, n)
    rtt_avg = rtt_avg.clip(5, 3000)

    packet_loss = (34 * stress ** 2.6 + rng.exponential(0.25, n)).clip(0, 100)
    jitter = (2 + 260 * stress ** 2.4 + rng.exponential(2, n)).clip(0, 500)

    # The broker link degrades with stress but drops out only when it is severe.
    broker_rtt = (12 + 1800 * stress ** 3 + rng.exponential(6, n)).clip(3, 4000)
    bridge_alive = rng.random(n) > (0.55 * np.clip(stress - 0.55, 0, 1) / 0.45)

    # Pi-side send queue: grows while the link is stressed, drains when it is not.
    queue_depth = np.zeros(n, dtype=int)
    q = 0.0
    for t in range(n):
        q += 26 * stress[t] ** 2 - 5 * (1 - stress[t])
        q = float(np.clip(q + rng.normal(0, 1.2), 0, 200))
        queue_depth[t] = int(q)

    # Kept for the QoS model only — the Pi cannot measure these, so they are
    # excluded from the state model's feature list.
    bandwidth = (50 * (1 - stress) ** 2 + rng.normal(0, 1.5, n)).clip(0.1, 100)
    throughput = (220 * (1 - stress) ** 1.6 + rng.normal(0, 8, n)).clip(0, 500)
    drop_rate = (packet_loss * 0.5 + rng.exponential(0.2, n)).clip(0, 60)
    clients = rng.poisson(np.clip(38 * (1 - stress) + 4, 1, None)).clip(0, 90)

    return {
        'rtt_avg': rtt_avg,
        'rtt_max': (rtt_avg + jitter * 2).clip(5, 5000),
        'packet_loss': packet_loss,
        'jitter': jitter,
        'broker_rtt': broker_rtt,
        'bridge_alive': bridge_alive,
        'queue_depth': queue_depth,
        'bandwidth': bandwidth,
        'throughput': throughput,
        'drop_rate': drop_rate,
        'clients': clients,
    }


SEVERITY = {'STABLE': 0, 'DEGRADED': 1, 'CRITICAL': 2}
INV_SEVERITY = {0: 'STABLE', 1: 'DEGRADED', 2: 'CRITICAL'}


def label_network_state(df):
    """Threshold rule describing the link *right now*.

    This is a definition, not a prediction — it is why the old model scored a
    meaningless 1.0. It stays because SAAMP's behaviour is specified in these
    terms, but the model's target is the *next* sample's label, which no rule
    over the current row can produce.
    """
    rules = [
        (df['packet_loss'] >= 15) | (df['rtt_avg'] >= 1000) | (~df['bridge_alive'].astype(bool)),
        (df['packet_loss'] >= 5) | (df['rtt_avg'] >= 300) | (df['queue_depth'] >= 100),
    ]
    return np.select(rules, ['CRITICAL', 'DEGRADED'], default='STABLE')


def generate_timeseries(n, rng, start='2024-06-01'):
    """One continuous 30-second-cadence trace, in chronological order."""
    timestamps = pd.date_range(start, periods=n, freq='30s')
    hours = np.asarray(timestamps.hour, dtype=float)

    stress = _simulate_stress(n, hours, rng)
    df = pd.DataFrame(_metrics_from_stress(stress, rng))

    df['timestamp'] = timestamps
    df['hour'] = hours
    df['day_of_week'] = np.asarray(timestamps.dayofweek, dtype=float)
    df['queue_delta'] = df['queue_depth'].diff().fillna(0).astype(int)
    df['stress'] = stress          # latent ground truth, never a feature

    df['network_state'] = label_network_state(df)
    df['next_network_state'] = df['network_state'].shift(-1)

    # The real target: the worst the link gets over the next HORIZON samples.
    # This is what SAAMP needs to know — "should I start buffering?" — and
    # unlike the t+1 label it is not something persistence answers for free.
    sev = pd.Series(df['network_state']).map(SEVERITY)
    future_sev = (
        sev.shift(-1).rolling(HORIZON, min_periods=1).max()
           .shift(-(HORIZON - 1))
    )
    df['future_network_state'] = future_sev.map(INV_SEVERITY)
    return df


def delivery_probability(row, qos_level):
    """Probability a message is delivered, given conditions and the QoS used.

    This is the simulator's physics. It is also the yardstick any QoS policy is
    scored against, so keep in mind what that does and does not prove: beating
    the rule table here shows the table is miscalibrated *relative to these
    assumptions*, not that it is wrong about a real camp link.
    """
    if not row['bridge_alive']:
        return 0.0

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

    if net_ok:
        base_p = {0: 0.70, 1: 0.95, 2: 0.99}
    elif net_bad:
        base_p = {0: 0.10, 1: 0.30, 2: 0.60}
    else:
        base_p = {0: 0.40, 1: 0.75, 2: 0.90}

    return base_p.get(qos_level, 0.50)


# Reliability each priority must actually achieve. This is the requirement
# SAAMP exists to serve — a gate check-in must get through; a heartbeat need
# not — and it is a policy decision, deliberately explicit rather than learned.
QOS_RELIABILITY_TARGET = {0: 0.70, 1: 0.90, 2: 0.95, 3: 0.99}


def required_qos(row, priority):
    """Lowest QoS whose delivery *probability* meets this priority's bar.

    Note what this is not: `optimal_qos` picks the lowest QoS that happened to
    succeed in a single random draw, so one lucky QoS-0 send gets labelled
    optimal even though it fails 30% of the time. That target is noise-
    dominated and biased toward under-provisioning — following it exactly
    delivers *worse* than the hand-written rule table it was meant to beat.

    This asks the question that actually matters: what is the cheapest QoS that
    meets the reliability this message needs?
    """
    need = QOS_RELIABILITY_TARGET[priority]
    for qos in (0, 1, 2):
        if delivery_probability(row, qos) >= need:
            return qos

    # Nothing clears the bar. Time-sensitive CRITICAL traffic still goes out
    # best-effort — publish() now buffers it if the ack fails — while anything
    # else is better held for the recovery flush.
    return 2 if priority == 3 else -1


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

    Emitted in chronological order with `network_state` (now) and
    `next_network_state` (the t+1 target). Class balance is whatever the latent
    stress process produces rather than a quota, so it shifts with the tuning
    constants above.
    """
    rng = np.random.default_rng(RANDOM_STATE)

    # Chronological, and deliberately NOT shuffled: the rolling features and the
    # t+1 target both depend on row order.
    df = generate_timeseries(n_samples, rng)

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

    simulate_outcome = lambda qos_level, row: delivery_probability(row, qos_level)

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
    df['required_qos'] = [
        required_qos(row, int(row['priority'])) for _, row in df.iterrows()
    ]

    df['qos_delta'] = df['saamp_qos'] - df['optimal_qos']
    # Positive = over-provisioned using too high QoS (wasteful)
    # Negative = under-provisioned (risked delivery failure)

    df['is_overprovisioned']  = (df['qos_delta'] > 0).astype(int)
    df['is_underprovisioned'] = (df['qos_delta'] < 0).astype(int)

    # Trailing rows have no complete future window.
    df = df[df['future_network_state'].notna()].reset_index(drop=True)

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
