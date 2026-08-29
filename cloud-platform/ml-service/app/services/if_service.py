import base64
import pickle
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import numpy as np
from sqlalchemy import select, update, insert
from sklearn.ensemble import IsolationForest

from ..database import pages_if_models, pages_if_insights, pages_sessions

BEHAVIORAL_SIGNALS = [
    'accuracy',
    'false_tap_rate',
    'avg_reaction_time',
    'reaction_variance',
    'idle_time_ratio',
    'rapid_click_count',
    'time_to_first_interaction',
    'completion_ratio',
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def session_to_feature_vector(session: dict | list) -> list[float]:

    if isinstance(session, (list, tuple)):
        if len(session) == 8:
            return [float(x) for x in session]
        padded = [float(x) for x in session] + [0.0] * (8 - len(session))
        return padded[:8]

    if not isinstance(session, dict):
        return [0.0] * 8

    # Unpack nested structures if taskMetrics or passiveSignals dictionaries are passed
    flat = dict(session)
    for nested_key in ('taskMetrics', 'task_metrics', 'passiveSignals', 'passive_signals'):
        if nested_key in session and isinstance(session[nested_key], dict):
            flat.update(session[nested_key])

    # 1. Accuracy
    acc = (
        flat.get('accuracy')
        if flat.get('accuracy') is not None
        else flat.get('accuracyRate')
        if flat.get('accuracyRate') is not None
        else flat.get('accuracy_rate')
    )

    # 2. False tap rate
    ftr = (
        flat.get('false_tap_rate')
        if flat.get('false_tap_rate') is not None
        else flat.get('falseTapRate')
    )

    # 3. Average reaction time
    art = (
        flat.get('avg_reaction_time')
        if flat.get('avg_reaction_time') is not None
        else flat.get('avgReactionTime')
        if flat.get('avgReactionTime') is not None
        else flat.get('average_reaction_time')
    )

    # 4. Reaction variance
    rv = (
        flat.get('reaction_variance')
        if flat.get('reaction_variance') is not None
        else flat.get('reactionVariance')
    )

    # 5. Idle time ratio
    itr = (
        flat.get('idle_time_ratio')
        if flat.get('idle_time_ratio') is not None
        else flat.get('idleTimeRatio')
    )

    # 6. Rapid click count
    rcc = (
        flat.get('rapid_click_count')
        if flat.get('rapid_click_count') is not None
        else flat.get('rapidClickCount')
    )

    # 7. Time to first interaction
    ttf = (
        flat.get('time_to_first_interaction')
        if flat.get('time_to_first_interaction') is not None
        else flat.get('timeToFirstMs')
        if flat.get('timeToFirstMs') is not None
        else flat.get('time_to_first_ms')
        if flat.get('time_to_first_ms') is not None
        else flat.get('timeToFirstInteraction')
    )

    # 8. Completion ratio
    cr = (
        flat.get('completion_ratio')
        if flat.get('completion_ratio') is not None
        else flat.get('completionRatio')
    )

    # Graceful fallback for legacy sessions containing only aggregate scores
    if (
        acc is None
        and ftr is None
        and art is None
        and rv is None
        and itr is None
        and rcc is None
        and ttf is None
        and cr is None
    ):
        comp = float(flat.get('composite') or flat.get('composite_score') or 0.0)
        task = float(flat.get('task') or flat.get('task_score') or 0.0)
        passive = float(flat.get('passive') or flat.get('passive_score') or 0.0)
        acc = task / 100.0 if task else (comp / 100.0)
        ftr = max(0.0, 1.0 - (task / 100.0)) if task else 0.0
        art = 350.0
        rv = 100.0
        itr = max(0.0, 1.0 - (passive / 100.0)) if passive else 0.0
        rcc = 0.0
        ttf = 250.0
        cr = passive / 100.0 if passive else (comp / 100.0)

    return [
        float(acc if acc is not None else 0.0),
        float(ftr if ftr is not None else 0.0),
        float(art if art is not None else 0.0),
        float(rv if rv is not None else 0.0),
        float(itr if itr is not None else 0.0),
        float(rcc if rcc is not None else 0.0),
        float(ttf if ttf is not None else 0.0),
        float(cr if cr is not None else 0.0),
    ]


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


def train_if_model(
    child_id: str,
    history: dict,
    config,
) -> IsolationForest | None:
 
    sessions = history.get(child_id, [])
    features = [session_to_feature_vector(s) for s in sessions if s]

    if len(features) < config.IF_MIN_SESSIONS:
        return None

    # Use the last 50 previous sessions for localized per-child baseline
    features = features[-50:]

    try:
        X = np.array(features, dtype=float)
        if X.ndim != 2 or X.shape[1] != 8:
            return None

        model = IsolationForest(
            contamination=0.1,
            random_state=42,
            n_estimators=100,
        )
        model.fit(X)

        # Save to local filesystem if MODELS_DIR is configured
        if hasattr(config, 'MODELS_DIR') and config.MODELS_DIR:
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
    now = _now_iso()

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
    current_session: dict,
    history: dict,
    config,
    engine=None,
) -> dict | None:
    """Isolation Forest anomaly score; active from session IF_MIN_SESSIONS onward.

    Uses the same 8 raw behavioral features as training:
    [accuracyRate, falseTapRate, avgReactionTime, reactionVariance,
     idleTimeRatio, rapidClickCount, timeToFirstMs, completionRatio]
    """
    previous_sessions = history.get(child_id, [])

    # Isolation Forest becomes active only after the minimum
    # number of previous sessions has been collected.
    if len(previous_sessions) < config.IF_MIN_SESSIONS:
        return None

    # Train ONLY on previous sessions.
    model = train_if_model(
        child_id=child_id,
        history=history,
        config=config,
    )

    if model is None:
        return None

    try:
        # Convert CURRENT session into the same 8-feature vector.
        current_feature = session_to_feature_vector(current_session)

        feature_vector = np.array(
            [current_feature],
            dtype=float
        )

        # Raw Isolation Forest score.
        raw_score = float(
            model.score_samples(feature_vector)[0]
        )

        # Decision score.
        decision_score = float(
            model.decision_function(feature_vector)[0]
        )

        # Final anomaly decision.
        is_anomaly = decision_score < 0

        return {
            'raw_score': round(raw_score, 4),
            'decision_score': round(decision_score, 4),
            'is_anomaly': is_anomaly,
        }

    except Exception as e:
        print(
            f'[IF] Could not compute IF score '
            f'for {child_id}: {e}'
        )
        return None

def save_if_insight(
    engine,
    child_id: str,
    session_id: str,
    raw_score: float, 
    decision_score: float, 
    anomaly_flagged: bool,
    composite_score: float,
    task_score: float,
    passive_score: float,
    contributions: dict,
):
    """Save IF prediction insight to database for cloud dashboard."""
    insight_id = str(uuid4())
    now = _now_iso()

    with engine.begin() as conn:
        conn.execute(
            insert(pages_if_insights).values(
                insight_id=insight_id,
                child_id=child_id,
                session_id=session_id,
                raw_score=raw_score, 
                decision_score=decision_score,
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
