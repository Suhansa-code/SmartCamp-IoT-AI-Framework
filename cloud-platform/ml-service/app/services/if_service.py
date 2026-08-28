"""Isolation Forest service — model persistence, scoring, and insights for cloud platform."""

import base64
import pickle
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import numpy as np
from sqlalchemy import select, update, insert
from sklearn.ensemble import IsolationForest

from ..database import pages_if_models, pages_if_insights, pages_sessions
from .scoring_service import session_to_feature_vector


def _model_path(config, child_id: str) -> Path:
    return Path(config.MODELS_DIR) / f'{child_id}.pkl'


def serialize_model(model) -> str:
    """Serialize Isolation Forest model to base64 string for DB storage."""
    pickled = pickle.dumps(model)
    return base64.b64encode(pickled).decode('ascii')


def deserialize_model(blob: str):
    """Deserialize Isolation Forest model from base64 string."""
    pickled = base64.b64decode(blob.encode('ascii'))
    return pickle.loads(pickled)


def train_if_model(child_id: str, history: dict, config, include_current: list | None = None):
    """Train (or update) the per-child Isolation Forest model."""
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

        # Save to local filesystem
        path = _model_path(config, child_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'wb') as f:
            pickle.dump(model, f)

        return model
    except Exception as e:
        print(f'[IF] Train failed for {child_id}: {e}')
        return None


def save_model_to_db(engine, child_id: str, model, feature_count: int, session_count: int):
    """Persist trained model to database."""
    blob = serialize_model(model)
    now = datetime.utcnow().isoformat()

    with engine.begin() as conn:
        existing = conn.execute(
            select(pages_if_models.c.child_id).where(pages_if_models.c.child_id == child_id)
        ).first()

        if existing:
            conn.execute(
                update(pages_if_models)
                .where(pages_if_models.c.child_id == child_id)
                .values(
                    model_blob=blob,
                    feature_count=feature_count,
                    session_count=session_count,
                    updated_at=now,
                )
            )
        else:
            conn.execute(
                insert(pages_if_models).values(
                    child_id=child_id,
                    model_blob=blob,
                    feature_count=feature_count,
                    session_count=session_count,
                    trained_at=now,
                    updated_at=now,
                )
            )


def load_model_from_db(engine, child_id: str):
    """Load trained model from database."""
    with engine.connect() as conn:
        row = conn.execute(
            select(pages_if_models.c.model_blob).where(pages_if_models.c.child_id == child_id)
        ).mappings().first()

        if row and row['model_blob']:
            try:
                return deserialize_model(row['model_blob'])
            except Exception as e:
                print(f'[IF] Could not deserialize model for {child_id}: {e}')
                return None
    return None


def compute_if_score(
    child_id: str,
    task_metrics: dict,
    passive_signals: dict,
    history: dict,
    config,
    engine,
) -> float | None:
    """Isolation Forest anomaly score; active from session IF_MIN_SESSIONS onward.

    Uses the same 8 raw behavioral features as training:
    [accuracyRate, falseTapRate, avgReactionTime, reactionVariance,
     idleTimeRatio, rapidClickCount, timeToFirstMs, completionRatio]
    """
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
    model = None

    # Try to train/update model
    if total_sessions_after_current >= config.IF_MIN_SESSIONS:
        model = train_if_model(child_id, history, config, include_current=current_feature)
        if model is not None:
            feature_count = len(history.get(child_id, [])) + 1
            save_model_to_db(engine, child_id, model, feature_count, total_sessions_after_current)

    # Fallback: load from DB
    if model is None:
        model = load_model_from_db(engine, child_id)

    # Fallback: load from local filesystem
    if model is None:
        path = _model_path(config, child_id)
        if path.exists():
            try:
                with open(path, 'rb') as f:
                    model = pickle.load(f)
                print(f'[IF] {child_id}: Loaded model from filesystem')
            except Exception as e:
                print(f'[IF] Could not load filesystem model for {child_id}: {e}')

    if model is None:
        return None

    try:
        feature_vector = np.array([current_feature])
        if_score = float(model.score_samples(feature_vector)[0])
        return round(if_score, 4)
    except Exception as e:
        print(f'[IF] Could not compute IF score for {child_id}: {e}')
        return None


def save_if_insight(
    engine,
    child_id: str,
    session_id: str,
    if_score: float,
    anomaly_flagged: bool,
    composite_score: float,
    task_score: float,
    passive_score: float,
    contributions: dict,
):
    """Save IF prediction insight to database for cloud dashboard."""
    insight_id = str(uuid4())
    now = datetime.utcnow().isoformat()

    with engine.begin() as conn:
        conn.execute(
            insert(pages_if_insights).values(
                insight_id=insight_id,
                child_id=child_id,
                session_id=session_id,
                if_score=if_score,
                anomaly_flagged=1 if anomaly_flagged else 0,
                composite_score=composite_score,
                task_score=task_score,
                passive_score=passive_score,
                contribution_composite=contributions.get('composite', 0),
                contribution_task=contributions.get('task', 0),
                contribution_passive=contributions.get('passive', 0),
                created_at=now,
            )
        )


def get_child_insights(engine, child_id: str, limit: int = 50):
    """Retrieve IF insights for a child (for cloud dashboard)."""
    with engine.connect() as conn:
        rows = conn.execute(
            select(pages_if_insights)
            .where(pages_if_insights.c.child_id == child_id)
            .order_by(pages_if_insights.c.created_at.desc())
            .limit(limit)
        ).mappings().all()

    return [dict(row) for row in rows]


def get_model_info(engine, child_id: str):
    """Get model metadata for a child."""
    with engine.connect() as conn:
        row = conn.execute(
            select(pages_if_models).where(pages_if_models.c.child_id == child_id)
        ).mappings().first()

    return dict(row) if row else None


def get_all_models_summary(engine):
    """Get summary of all IF models for admin dashboard."""
    with engine.connect() as conn:
        rows = conn.execute(
            select(pages_if_models)
            .order_by(pages_if_models.c.updated_at.desc())
        ).mappings().all()

    return [dict(row) for row in rows]


def reset_child(engine, child_id: str):
    """Reset IF data for a child (testing only)."""
    from sqlalchemy import delete
    with engine.begin() as conn:
        conn.execute(delete(pages_if_models).where(pages_if_models.c.child_id == child_id))
        conn.execute(delete(pages_if_insights).where(pages_if_insights.c.child_id == child_id))