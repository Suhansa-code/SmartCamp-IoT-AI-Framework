"""Trains and evaluates a model-driven QoS policy against SAAMP's rule table.

The state model answers "how bad is the link about to get?". This answers the
next question — "so what QoS should this message use, and should it go at all?"
— which SAAMP currently decides with a hand-written table in saamp-mqtt.js.

Target is `required_qos`: the cheapest QoS whose delivery *probability* meets
the reliability that message's priority requires, or -1 meaning buffer it.

Not `optimal_qos` — that one takes the lowest QoS that happened to succeed in a
single random draw, so a lucky QoS-0 send counts as optimal despite failing 30%
of the time. It is noise-dominated (the model could only reach 0.49 accuracy on
it) and biased toward under-provisioning: following those labels exactly
delivers 0.715 against the rule table's 0.825.

Read the evaluation honestly. Both policies are scored against
`delivery_probability`, the simulator's own physics. Winning here means the
rule table is miscalibrated *relative to those assumptions*. It is not evidence
about a real camp link.
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).resolve().parent
MODELS_DIR = HERE.parent / 'models'
DATA_DIR = HERE.parent / 'data'

from data_generator import (QOS_RELIABILITY_TARGET, delivery_probability,   # noqa: E402
                            generate_synthetic_dataset)
from feature_extraction import FEATURE_COLS, WINDOW, engineer_features       # noqa: E402

# Same measurability constraint as the state model: everything here can be read
# on the Pi. bandwidth / throughput / drop_rate / clients are in the dataset but
# cannot be measured at inference, so they are not features.
QOS_FEATURES = FEATURE_COLS + ['priority_scaled']

TARGET = 'required_qos'
BUFFER = -1
PRIORITIES = {0: 'LOW', 1: 'MEDIUM', 2: 'HIGH', 3: 'CRITICAL'}


def load_data():
    csv = DATA_DIR / 'network_qos_dataset.csv'
    return pd.read_csv(csv) if csv.exists() else generate_synthetic_dataset(40000)


def preprocess(df):
    f = engineer_features(df)
    f['required_qos'] = df['required_qos']
    f['saamp_qos'] = df['saamp_qos']
    f['priority'] = df['priority']
    return f.iloc[WINDOW - 1:].reset_index(drop=True)


def score_policy(rows, chosen_qos, priorities):
    """Expected delivery and overhead for a policy's choices.

    Uses the delivery *probability* rather than a random draw — same physics,
    far less variance, so the comparison reflects the policy rather than luck.
    Broken out per priority because the aggregate hides the only failure that
    really costs anything: a CRITICAL message that did not get through.
    """
    per_priority = {name: {'delivered': [], 'qos': [], 'buffered': 0}
                    for name in PRIORITIES.values()}

    for row, qos, prio in zip(rows, chosen_qos, priorities):
        bucket = per_priority[PRIORITIES[int(prio)]]
        if qos == BUFFER:
            bucket['buffered'] += 1
            continue
        bucket['delivered'].append(delivery_probability(row, int(qos)))
        bucket['qos'].append(int(qos))

    out = {}
    all_d, all_q, all_b, n = [], [], 0, len(rows)
    for name, b in per_priority.items():
        total = len(b['delivered']) + b['buffered']
        out[name] = {
            'delivery_rate': round(float(np.mean(b['delivered'])), 4) if b['delivered'] else 0.0,
            'mean_qos': round(float(np.mean(b['qos'])), 3) if b['qos'] else 0.0,
            'buffered_pct': round(b['buffered'] / total * 100, 2) if total else 0.0,
            'meets_target': (round(float(np.mean(b['delivered'])), 4) if b['delivered'] else 0.0)
                            >= QOS_RELIABILITY_TARGET[
                                [k for k, v in PRIORITIES.items() if v == name][0]],
        }
        all_d += b['delivered']
        all_q += b['qos']
        all_b += b['buffered']

    out['overall'] = {
        'delivery_rate': round(float(np.mean(all_d)), 4) if all_d else 0.0,
        'mean_qos': round(float(np.mean(all_q)), 3) if all_q else 0.0,
        'buffered_pct': round(all_b / n * 100, 2),
    }
    return out


def train_qos_model(output_dir=None):
    output_dir = Path(output_dir) if output_dir else MODELS_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    raw = load_data()
    df = preprocess(raw)
    raw_aligned = raw.iloc[WINDOW - 1:].reset_index(drop=True)

    X = df[QOS_FEATURES].fillna(0)
    y = df[TARGET]

    split = int(len(X) * 0.8)
    scaler = StandardScaler().fit(X.iloc[:split])
    X_train, X_test = scaler.transform(X.iloc[:split]), scaler.transform(X.iloc[split:])
    y_train, y_test = y.iloc[:split], y.iloc[split:]

    model = RandomForestClassifier(
        n_estimators=120, max_depth=10, min_samples_leaf=20,
        class_weight='balanced', n_jobs=-1, random_state=42,
    ).fit(X_train, y_train)

    pred = model.predict(X_test)
    test_rows = raw_aligned.iloc[split:].to_dict('records')

    prio_test = df['priority'].iloc[split:].to_numpy()

    model_score = score_policy(test_rows, pred, prio_test)
    rule_score = score_policy(test_rows, df['saamp_qos'].iloc[split:].to_numpy(), prio_test)
    oracle_score = score_policy(test_rows, y_test.to_numpy(), prio_test)

    print(f"Target        : {TARGET} (-1 = buffer)")
    print(f"Train / test  : {len(y_train)} / {len(y_test)} (chronological)")
    print(f"Label accuracy: {(pred == y_test).mean():.4f}\n")
    print(classification_report(y_test, pred, zero_division=0))

    print("Policy comparison (scored on the simulator's delivery physics):\n")
    for name, s in [('SAAMP rules', rule_score), ('model', model_score), ('oracle', oracle_score)]:
        o = s['overall']
        print(f"  {name}  —  delivery {o['delivery_rate']}  "
              f"mean QoS {o['mean_qos']}  buffered {o['buffered_pct']}%")
        for prio in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'):
            b = s[prio]
            flag = 'ok ' if b['meets_target'] else 'MISS'
            print(f"      {prio:<9} delivery {b['delivery_rate']:<8} "
                  f"qos {b['mean_qos']:<7} buffered {b['buffered_pct']:>5}%   {flag}")
        print()

    joblib.dump(model, output_dir / 'qos_model.pkl')
    joblib.dump(scaler, output_dir / 'qos_scaler.pkl')
    joblib.dump(QOS_FEATURES, output_dir / 'qos_features.pkl')

    meta = {
        'model_type': 'RandomForestClassifier',
        'target': TARGET,
        'buffer_class': BUFFER,
        'features': QOS_FEATURES,
        'label_accuracy': round(float((pred == y_test).mean()), 4),
        'policy_comparison': {
            'saamp_rules': rule_score,
            'model': model_score,
            'oracle': oracle_score,
        },
        'notes': (
            'Both policies scored against data_generator.delivery_probability, '
            'the simulator physics that also defined the labels. Beating the '
            'rule table here shows the table is miscalibrated relative to those '
            'assumptions, not that it is wrong about a real link.'
        ),
    }
    (output_dir / 'qos_model_meta.json').write_text(json.dumps(meta, indent=2))
    print(f"\nSaved qos_model.pkl / qos_scaler.pkl / qos_features.pkl → {output_dir}")

    return model, scaler, meta


if __name__ == '__main__':
    train_qos_model()
