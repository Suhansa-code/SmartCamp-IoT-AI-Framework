import numpy as np
import pandas as pd

PRIORITY_MAP = {'LOW': 0, 'MEDIUM': 1, 'HIGH': 2, 'CRITICAL': 3}

# How many past samples the rolling features look back over. At the monitor's
# 30s cadence this is ~2.5 minutes of history.
WINDOW = 5

# Only what the Pi can genuinely measure. bandwidth / throughput / drop_rate /
# clients were previously derived from rtt_avg by fixed formulas at inference,
# so they carried no information in production while varying independently in
# training — textbook train/serve skew. They stay in the dataset for the QoS
# model but are not state-model features.
BASE_COLS = [
    'rtt_avg', 'rtt_max', 'packet_loss', 'jitter',
    'broker_rtt', 'bridge_alive', 'queue_depth', 'queue_delta',
]

ROLLING_COLS = ['rtt_avg', 'packet_loss', 'jitter', 'broker_rtt', 'queue_depth']

TIME_COLS = ['hour_sin', 'hour_cos', 'dow_sin', 'dow_cos']

FEATURE_COLS = (
    BASE_COLS
    + [f'{c}_mean_{WINDOW}' for c in ROLLING_COLS]
    + [f'{c}_slope_{WINDOW}' for c in ROLLING_COLS]
    + ['rtt_std_5', 'bridge_uptime_5', 'loss_rtt_product']
    + TIME_COLS
)


def _slope(series, window):
    """Per-sample change over the window — the trend the model extrapolates."""
    return (series - series.shift(window - 1)) / (window - 1)


def engineer_features(df):
    """Build model features from a chronologically ordered frame.

    Order matters: the rolling columns assume row i-1 is the previous sample.
    """
    f = df.copy()

    if 'hour' in f.columns:
        f['hour_sin'] = np.sin(2 * np.pi * f['hour'] / 24)
        f['hour_cos'] = np.cos(2 * np.pi * f['hour'] / 24)
    if 'day_of_week' in f.columns:
        f['dow_sin'] = np.sin(2 * np.pi * f['day_of_week'] / 7)
        f['dow_cos'] = np.cos(2 * np.pi * f['day_of_week'] / 7)

    if 'bridge_alive' in f.columns:
        f['bridge_alive'] = f['bridge_alive'].astype(int)

    if 'priority' in f.columns:
        f['priority_scaled'] = f['priority'] / 3.0

    if {'packet_loss', 'rtt_avg'} <= set(f.columns):
        f['loss_rtt_product'] = f['packet_loss'] * f['rtt_avg']

    for col in ROLLING_COLS:
        if col not in f.columns:
            continue
        roll = f[col].rolling(WINDOW, min_periods=1)
        f[f'{col}_mean_{WINDOW}'] = roll.mean()
        f[f'{col}_slope_{WINDOW}'] = _slope(f[col], WINDOW).fillna(0)

    if 'rtt_avg' in f.columns:
        f['rtt_std_5'] = f['rtt_avg'].rolling(WINDOW, min_periods=1).std().fillna(0)
    if 'bridge_alive' in f.columns:
        f['bridge_uptime_5'] = f['bridge_alive'].rolling(WINDOW, min_periods=1).mean()

    return f


def get_feature_cols(df_feat):
    drop_cols = {
        'timestamp', 'optimal_qos', 'optimal_qos_binned', 'priority_label',
        'base_qos', 'saamp_qos', 'qos_delta', 'is_overprovisioned',
        'is_underprovisioned', 'delivery_success', 'stress',
        'network_state', 'next_network_state', 'network_state_enc',
    }
    return [c for c in df_feat.select_dtypes('number').columns if c not in drop_cols]
