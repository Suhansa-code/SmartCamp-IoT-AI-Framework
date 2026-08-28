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


def compute_task_score(task_metrics: dict, config) -> float:
    """Compute task score (0-100) from Go/No-Go behavioral metrics."""
    accuracy_rate = float(task_metrics.get('accuracyRate', 0))
    false_tap_rate = float(task_metrics.get('falseTapRate', 0))
    avg_rt = float(task_metrics.get('avgReactionTime', 800))
    rt_variance = float(task_metrics.get('reactionVariance', 500))

    score = (
        accuracy_rate * 100 * config.TASK_ACCURACY_W
        + (1 - false_tap_rate) * 100 * config.TASK_FALSE_TAP_W
        + max(0, 1 - avg_rt / config.RT_NORM_BASE) * 100 * config.TASK_RT_W
        + max(0, 1 - rt_variance / config.VARIANCE_NORM_BASE) * 100 * config.TASK_VARIANCE_W
    )
    return round(min(max(score, 0), 100), 2)


def compute_passive_score(passive_signals: dict, config) -> float:
    """Compute passive score (0-100) from background interaction signals."""
    idle_ratio = float(passive_signals.get('idleTimeRatio', 0))
    rapid_clicks = float(passive_signals.get('rapidClickCount', 0))
    completion = float(passive_signals.get('completionRatio', 1))

    score = (
        (1 - idle_ratio) * 100 * config.PASSIVE_IDLE_W
        + max(0, 1 - rapid_clicks / config.RAPID_CLICKS_BASE) * 100 * config.PASSIVE_CLICKS_W
        + completion * 100 * config.PASSIVE_COMPLETION_W
    )
    return round(min(max(score, 0), 100), 2)


def compute_composite(task_score, passive_score, baseline, config):
    score = (
        task_score * config.COMPOSITE_TASK_W
        + passive_score * config.COMPOSITE_PASSIVE_W
        + baseline * config.COMPOSITE_BASELINE_W
    )

    return round(min(max(score, 0.0), 100.0), 2)


def compute_z_score(child_id: str, composite: float, history, config) -> float | None:
    """Z-score against the child's own history; active from session 3 onward."""
    prev_scores = [s['composite'] for s in history.get(child_id, [])]

    required_previous_sessions = config.ZSCORE_MIN_SESSIONS - 1

    if len(prev_scores) < required_previous_sessions:
        return None

    n = len(prev_scores)
    mean = sum(prev_scores) / n
    variance = sum((x - mean) ** 2 for x in prev_scores) / n
    std = math.sqrt(variance) if variance > 0 else 1.0

    z = (composite - mean) / std
    return round(z, 4)

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


def train_if_model(child_id: str, history, config, include_current: list | None = None):
    """Train (or update) the per-child Isolation Forest model."""
    if not NUMPY_AVAILABLE or not SKLEARN_AVAILABLE:
        return None

    features = [session_to_feature_vector(session) for session in history.get(child_id, [])]
    if include_current is not None:
        features.append(include_current)

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


def compute_if_score(child_id: str, task_metrics: dict, passive_signals: dict, history, config) -> float | None:
    """Isolation Forest anomaly score; active from session IF_MIN_SESSIONS onward.

    Uses the same 8 raw behavioral features as training:
    [accuracyRate, falseTapRate, avgReactionTime, reactionVariance,
     idleTimeRatio, rapidClickCount, timeToFirstMs, completionRatio]
    """
    if not NUMPY_AVAILABLE or not SKLEARN_AVAILABLE:
        return None

    total_sessions_after_current = len(history.get(child_id, [])) + 1
    if total_sessions_after_current < config.IF_MIN_SESSIONS:
        return None

    current_feature = session_to_feature_vector({
        'accuracyRate': task_metrics.get('accuracyRate', 0),
        'falseTapRate': task_metrics.get('falseTapRate', 0),
        'avgReactionTime': task_metrics.get('avgReactionTime', 0),
        'reactionVariance': task_metrics.get('reactionVariance', 0),
        'idleTimeRatio': passive_signals.get('idleTimeRatio', 0),
        'rapidClickCount': passive_signals.get('rapidClickCount', 0),
        'timeToFirstMs': passive_signals.get('timeToFirstMs', 0),
        'completionRatio': passive_signals.get('completionRatio', 0),
    })

    path = _model_path(config, child_id)
    model = None

    if total_sessions_after_current >= config.IF_MIN_SESSIONS:
        model = train_if_model(child_id, history, config, include_current=current_feature)

    if model is None and path.exists():
        try:
            with open(path, 'rb') as f:
                model = pickle.load(f)
        except Exception as e:
            print(f'[IF] Could not load existing model for {child_id}: {e}')
            return None

    if model is None:
        return None

    try:
        feature_vector = np.array([current_feature])
        if_score = float(model.score_samples(feature_vector)[0])
        return round(if_score, 4)
    except Exception as e:
        print(f'[IF] Could not compute IF score for {child_id}: {e}')
        return None