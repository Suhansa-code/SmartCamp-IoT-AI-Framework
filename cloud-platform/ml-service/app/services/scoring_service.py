"""Scoring service — pure functions for task/passive/composite scores and anomaly detection.

All formulas mirror the Node.js fallback in scoringService.js so both stacks agree.
"""

import math


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


def compute_composite(task_score: float, passive_score: float, baseline: float, config) -> float:
    """Composite = task×0.50 + passive×0.30 + baseline×0.20 (proposal §3.2.3)."""
    score = task_score * 0.50 + passive_score * 0.30 + baseline * 0.20
    return round(min(max(score, 0.0), 100.0), 2)


def compute_z_score(child_id: str, composite: float, history, config) -> float | None:
    """Z-score against the child's own history; active from session 3 onward."""
    prev_scores = [s['composite'] for s in history.get(child_id, [])]

    if len(prev_scores) < 2:
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
        float(session.get('composite', 0)),
        float(session.get('task', 0)),
        float(session.get('passive', 0)),
    ]