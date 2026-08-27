"""Scoring service — pure functions for task/passive/composite scores and anomaly detection.

All formulas mirror the Node.js fallback in scoringService.js so both stacks agree.
"""

import math
import pickle
from pathlib import Path

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

try:
    from sklearn.ensemble import IsolationForest
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    
def session_to_feature_vector(session: dict) -> list:
    """Map a saved session into the Isolation Forest feature vector format."""
    return [
        float(session.get('accuracyRate', 0)),
        float(session.get('falseTapRate', 0)),
        float(session.get('avgReactionTime', 0)),
        float(session.get('reactionVariance', 0)),
        float(session.get('idleTimeRatio', 0)),
        float(session.get('rapidClickCount', 0)),
        float(session.get('timeToFirstMs', 0)),
        float(session.get('completionRatio', 0)),
    ]


def _model_path(config, child_id: str) -> Path:
    return Path(config.MODELS_DIR) / f'{child_id}.pkl'


def train_if_model(child_id: str, history, config):
    """Train (or update) the per-child Isolation Forest model."""
    if not NUMPY_AVAILABLE or not SKLEARN_AVAILABLE:
        return None

    sessions = history.get(child_id, [])
    features = [session_to_feature_vector(session) for session in sessions]

    if len(features) < config.IF_MIN_SESSIONS:
        return None

    features = features[-50:]

    try:
        X = np.array(features)
        model = IsolationForest(contamination=0.1, random_state=42, n_estimators=100)
        model.fit(X)

        path = _model_path(config, child_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'wb') as f:
            pickle.dump(model, f)

        return model
    except Exception as e:
        print(f'[IF] Train failed for {child_id}: {e}')
        return None


def compute_if_score(child_id: str, current_session: dict, history, config) -> dict | None:
    """Isolation Forest anomaly score; active from session IF_MIN_SESSIONS onward."""
    if not NUMPY_AVAILABLE or not SKLEARN_AVAILABLE:
        return None

    previous_sessions = history.get(child_id, [])
    previous_session_count = len(previous_sessions)

    if previous_session_count < config.IF_MIN_SESSIONS:
        return None

    model = train_if_model(
        child_id=child_id,
        history=history,
        config=config
    )

    if model is None:

        path = _model_path(config, child_id)

        if not path.exists():
            return None

        try:
            with open(path, 'rb') as f:
                model = pickle.load(f)

        except Exception as e:
            print(
                f'[IF] Could not load existing model '
                f'for {child_id}: {e}'
            )
            return None

    current_feature = session_to_feature_vector(current_session)

    feature_vector = np.array(
        [current_feature],
        dtype=float
    )
    try:
        raw_score = float(
            model.score_samples(feature_vector)[0]
        )
        decision_score = float(
            model.decision_function(feature_vector)[0]
        )
        prediction = int(
            model.predict(feature_vector)[0]
        )
        is_anomaly = prediction == -1

        return {
            'raw_score': round(raw_score, 4),
            'decision_score': round(decision_score, 4),
            'prediction': prediction,
            'is_anomaly': is_anomaly
        }
    except Exception as e:

        print(
            f'[IF] Could not compute IF score '
            f'for {child_id}: {e}'
        )

        return None