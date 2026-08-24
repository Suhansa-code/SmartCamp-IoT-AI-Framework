import numpy as np
import pandas as pd

FEATURE_COLS = [
    'rtt_avg', 'rtt_max', 'packet_loss', 'jitter',
    'queue_depth', 'queue_delta', 'throughput', 'bandwidth',
    'drop_rate', 'bridge_alive', 'clients', 'hour',
    'day_of_week',
]

PRIORITY_MAP = {'LOW': 0, 'MEDIUM': 1, 'HIGH': 2, 'CRITICAL': 3}


def engineer_features(df):
    df_feat = df.copy()

    if 'hour' in df_feat.columns:
        df_feat['hour_sin'] = np.sin(2 * np.pi * df_feat['hour'] / 24)
        df_feat['hour_cos'] = np.cos(2 * np.pi * df_feat['hour'] / 24)

    if 'day_of_week' in df_feat.columns:
        df_feat['dow_sin'] = np.sin(2 * np.pi * df_feat['day_of_week'] / 7)
        df_feat['dow_cos'] = np.cos(2 * np.pi * df_feat['day_of_week'] / 7)

    if 'bridge_alive' in df_feat.columns:
        df_feat['bridge_alive'] = df_feat['bridge_alive'].astype(int)

    if 'priority' in df_feat.columns:
        df_feat['priority_scaled'] = df_feat['priority'] / 3.0

    if 'bandwidth' in df_feat.columns and 'rtt_avg' in df_feat.columns:
        safe_rtt = df_feat['rtt_avg'].replace(0, 1)
        df_feat['bw_rtt_ratio'] = df_feat['bandwidth'] / safe_rtt

    if 'packet_loss' in df_feat.columns and 'rtt_avg' in df_feat.columns:
        df_feat['loss_rtt_product'] = df_feat['packet_loss'] * df_feat['rtt_avg']

    return df_feat


def get_feature_cols(df_feat):
    drop_cols = {'timestamp', 'optimal_qos', 'optimal_qos_binned',
                 'priority_label', 'base_qos', 'saamp_qos',
                 'qos_delta', 'is_overprovisioned', 'is_underprovisioned',
                 'delivery_success'}
    return [c for c in df_feat.select_dtypes('number').columns if c not in drop_cols]
