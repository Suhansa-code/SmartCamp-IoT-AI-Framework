import numpy as np
import pandas as pd
import joblib
import json
from pathlib import Path

from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

HERE = Path(__file__).resolve().parent
MODELS_DIR = HERE.parent / 'models'
DATA_DIR = HERE.parent / 'data'

FEATURE_COLS = [
    'rtt_avg', 'rtt_max', 'packet_loss', 'jitter',
    'queue_depth', 'queue_delta', 'throughput', 'bandwidth',
    'drop_rate', 'bridge_alive', 'clients',
    'hour_sin', 'hour_cos', 'dow_sin', 'dow_cos',
    'priority_scaled', 'bw_rtt_ratio', 'loss_rtt_product',
]

STATE_MAP = {'STABLE': 0, 'DEGRADED': 1, 'CRITICAL': 2}
INV_STATE_MAP = {v: k for k, v in STATE_MAP.items()}


def label_network_state(df):
    rules = [
        (df['packet_loss'] >= 15) | (df['rtt_avg'] >= 1000) | (~df['bridge_alive'].astype(bool)),
        (df['packet_loss'] >= 5) | (df['rtt_avg'] >= 300) | (df['queue_depth'] >= 100),
    ]
    choices = ['CRITICAL', 'DEGRADED']
    return np.select(rules, choices, default='STABLE')


def load_or_generate_data():
    csv_path = DATA_DIR / 'network_qos_dataset.csv'
    if csv_path.exists():
        df = pd.read_csv(csv_path)
    else:
        from data_generator import generate_synthetic_dataset
        df = generate_synthetic_dataset(20000)
    return df


def preprocess(df):
    from feature_extraction import engineer_features, get_feature_cols
    df_feat = engineer_features(df)
    df_feat['network_state'] = label_network_state(df)
    df_feat['network_state_enc'] = df_feat['network_state'].map(STATE_MAP)
    return df_feat


def train_predictor(retrain=False, output_dir=None):
    output_dir = Path(output_dir) if output_dir else MODELS_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    df = load_or_generate_data()
    df_feat = preprocess(df)

    X = df_feat[FEATURE_COLS].fillna(0)
    y = df_feat['network_state_enc']

    split = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split], X.iloc[split:]
    y_train, y_test = y.iloc[:split], y.iloc[split:]

    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc = scaler.transform(X_test)

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=5,
        class_weight='balanced',
        random_state=42,
    )
    model.fit(X_train_sc, y_train)

    y_pred = model.predict(X_test_sc)
    report = classification_report(y_test, y_pred,
                                   target_names=list(STATE_MAP.keys()),
                                   output_dict=True)
    cm = confusion_matrix(y_test, y_pred)

    acc = (y_pred == y_test).mean()
    print(f"Accuracy: {acc:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=list(STATE_MAP.keys())))

    joblib.dump(model, output_dir / 'network_model.pkl')
    joblib.dump(scaler, output_dir / 'network_scaler.pkl')
    joblib.dump(FEATURE_COLS, output_dir / 'network_features.pkl')

    meta = {
        'model_type': 'RandomForestClassifier',
        'features': FEATURE_COLS,
        'accuracy': round(float(acc), 4),
        'classification_report': report,
        'state_map': STATE_MAP,
    }
    (output_dir / 'network_model_meta.json').write_text(json.dumps(meta, indent=2))

    print("\nSaved:")
    for f in ['network_model.pkl', 'network_scaler.pkl',
              'network_features.pkl', 'network_model_meta.json']:
        print(f"  {output_dir / f}")

    return model, scaler


def predict_network_state(network_metrics, priority, model, scaler):
    """
    Real-time prediction: given current metrics + message priority,
    return the predicted network state (STABLE/DEGRADED/CRITICAL).

    network_metrics: dict with keys matching the simulation metrics
    priority: int 0-3 (LOW=0, MEDIUM=1, HIGH=2, CRITICAL=3)
    """
    row = {**network_metrics, 'priority': priority}
    df = pd.DataFrame([row])
    from feature_extraction import engineer_features
    df_feat = engineer_features(df)
    X = df_feat[FEATURE_COLS].fillna(0)
    X_sc = scaler.transform(X)
    pred_enc = model.predict(X_sc)[0]
    return INV_STATE_MAP[pred_enc]


if __name__ == '__main__':
    train_predictor()
