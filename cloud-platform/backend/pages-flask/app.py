import os
import math
import pickle
import logging
import uuid
from pathlib import Path
from datetime import datetime

from flask import Flask, request, jsonify
from sqlalchemy import (
    Column,
    Float,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    delete,
    insert,
    select,
    text,
    update,
)

# ── Optional: numpy + scikit-learn (used for Isolation Forest) ───────────────
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

# ── App setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%dT%H:%M:%S',
)
logger = logging.getLogger(__name__)

# ── Constants (matching Node.js constants.js) ─────────────────────────────────
GATE_THRESHOLD       = float(os.getenv('GATE_THRESHOLD',    '55'))
BASELINE_ALPHA       = float(os.getenv('BASELINE_ALPHA',    '0.20'))
BASELINE_INIT        = float(os.getenv('BASELINE_INIT',     '60.0'))
ZSCORE_THRESHOLD     = float(os.getenv('ZSCORE_THRESHOLD',  '-2.0'))
IF_SCORE_THRESHOLD   = float(os.getenv('IF_SCORE_THRESHOLD','-0.10'))
ZSCORE_MIN_SESSIONS  = int(os.getenv('ZSCORE_MIN_SESSIONS', '3'))
IF_MIN_SESSIONS      = int(os.getenv('IF_MIN_SESSIONS',     '8'))

# Scoring weights — must match Node.js fallback formula for consistency
TASK_ACCURACY_W    = 0.40
TASK_FALSE_TAP_W   = 0.30
TASK_RT_W          = 0.15
TASK_VARIANCE_W    = 0.15

PASSIVE_IDLE_W     = 0.35
PASSIVE_CLICKS_W   = 0.25
PASSIVE_COMPLETION_W = 0.40

COMPOSITE_TASK_W   = 0.60
COMPOSITE_PASSIVE_W = 0.40

# Normalisation baselines for RT and variance
RT_NORM_BASE        = 800    # ms — reaction time above this scores 0
VARIANCE_NORM_BASE  = 500    # ms — variance above this scores 0
RAPID_CLICKS_BASE   = 10     # count above this scores 0

# ── Persistence paths / database ──────────────────────────────────────────────
DATA_DIR    = Path(os.getenv('DATA_DIR',    './data'))
MODELS_DIR  = Path(os.getenv('MODELS_DIR',  './models'))
SQLITE_PATH = Path(os.getenv('SQLITE_PATH', './data/pages.db'))

DATA_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)
SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)


def _build_database_url() -> str:
    postgres_url = os.getenv('POSTGRES_URL')
    if postgres_url:
        if postgres_url.startswith(('postgresql://', 'postgresql+psycopg2://', 'sqlite://')):
            return postgres_url

        postgres_user = os.getenv('POSTGRES_USER')
        postgres_password = os.getenv('POSTGRES_PASSWORD', '')
        postgres_db = os.getenv('POSTGRES_DB')
        postgres_host = os.getenv('POSTGRES_HOST', postgres_url)

        if postgres_user and postgres_db:
            auth = f'{postgres_user}:{postgres_password}@' if postgres_password else f'{postgres_user}@'
            return f'postgresql+psycopg2://{auth}{postgres_host}/{postgres_db}'

    return f'sqlite:///{SQLITE_PATH.as_posix()}'


DATABASE_URL = _build_database_url()
ENGINE_OPTIONS = {'connect_args': {'check_same_thread': False}} if DATABASE_URL.startswith('sqlite') else {'pool_pre_ping': True}
engine = create_engine(DATABASE_URL, future=True, **ENGINE_OPTIONS)
metadata = MetaData()

pages_children = Table(
    'pages_children',
    metadata,
    Column('child_id', String, primary_key=True),
    Column('res_id', String, nullable=False),
    Column('grade', Integer, nullable=False),
    Column('camp_id', String, nullable=False),
    Column('zone_id', String),
    Column('language', String, nullable=False, server_default=text("'si'")),
    Column('enrolled_at', Text, nullable=False),
    Column('total_sessions', Integer, nullable=False, server_default=text('0')),
    Column('baseline_score', Float, nullable=False, server_default=text('60.0')),
    Column('consecutive_low', Integer, nullable=False, server_default=text('0')),
    Column('sdq_band', String, nullable=False, server_default=text("'unknown'")),
    Column('alert_status', String, nullable=False, server_default=text("'none'")),
    Column('synced', Integer, nullable=False, server_default=text('0')),
)

pages_sessions = Table(
    'pages_sessions',
    metadata,
    Column('session_id', String, primary_key=True),
    Column('child_id', String, ForeignKey('pages_children.child_id'), nullable=False),
    Column('content_session_id', String),
    Column('session_date', Text, nullable=False),
    Column('session_time', Text, nullable=False),
    Column('condition_label', String, nullable=False, server_default=text("'A'")),
    Column('composite_score', Float),
    Column('task_score', Float),
    Column('passive_score', Float),
    Column('baseline_score_used', Float, nullable=False),
    Column('gate_decision', String),
    Column('second_gate_score', Float),
    Column('cognitive_score', Float),
    Column('session_complete', Integer, nullable=False, server_default=text('0')),
    Column('anomaly_flagged', Integer, nullable=False, server_default=text('0')),
    Column('z_score', Float),
    Column('if_score', Float),
    Column('alert_triggered', Integer, nullable=False, server_default=text('0')),
    Column('synced', Integer, nullable=False, server_default=text('0')),
    Column('created_at', Text, nullable=False),
)

pages_behavioral_signals = Table(
    'pages_behavioral_signals',
    metadata,
    Column('signal_id', String, primary_key=True),
    Column('session_id', String, ForeignKey('pages_sessions.session_id'), nullable=False),
    Column('child_id', String, ForeignKey('pages_children.child_id'), nullable=False),
    Column('accuracy_rate', Float, nullable=False),
    Column('false_tap_rate', Float, nullable=False),
    Column('avg_reaction_time', Float, nullable=False),
    Column('reaction_variance', Float, nullable=False),
    Column('idle_time_ratio', Float, nullable=False),
    Column('rapid_click_count', Integer, nullable=False, server_default=text('0')),
    Column('time_to_first_ms', Float, nullable=False),
    Column('completion_ratio', Float, nullable=False),
    Column('synced', Integer, nullable=False, server_default=text('0')),
)

pages_gate_decisions = Table(
    'pages_gate_decisions',
    metadata,
    Column('decision_id', String, primary_key=True),
    Column('session_id', String, ForeignKey('pages_sessions.session_id'), nullable=False),
    Column('child_id', String, ForeignKey('pages_children.child_id'), nullable=False),
    Column('attempt_number', Integer, nullable=False),
    Column('composite_score', Float, nullable=False),
    Column('decision', String, nullable=False),
    Column('decided_at', Text, nullable=False),
    Column('synced', Integer, nullable=False, server_default=text('0')),
)

pages_alerts = Table(
    'pages_alerts',
    metadata,
    Column('alert_id', String, primary_key=True),
    Column('child_id', String, ForeignKey('pages_children.child_id'), nullable=False),
    Column('camp_id', String, nullable=False),
    Column('res_id', String, nullable=False),
    Column('alert_type', String, nullable=False),
    Column('trigger_detail', Text, nullable=False),
    Column('triggered_at', Text, nullable=False),
    Column('status', String, nullable=False, server_default=text("'pending'")),
    Column('resolved_at', Text),
    Column('resolved_notes', Text),
    Column('synced', Integer, nullable=False, server_default=text('0')),
)

pages_sync_queue = Table(
    'pages_sync_queue',
    metadata,
    Column('queue_id', Integer, primary_key=True, autoincrement=True),
    Column('table_name', String, nullable=False),
    Column('record_id', String, nullable=False),
    Column('operation', String, nullable=False, server_default=text("'INSERT'")),
    Column('sync_status', String, nullable=False, server_default=text("'pending'")),
    Column('retry_count', Integer, nullable=False, server_default=text('0')),
    Column('created_at', Text, nullable=False),
    Column('synced_at', Text),
)

pages_sync_log = Table(
    'pages_sync_log',
    metadata,
    Column('log_id', Integer, primary_key=True, autoincrement=True),
    Column('records_pushed', Integer, nullable=False, server_default=text('0')),
    Column('model_files_pulled', Integer, nullable=False, server_default=text('0')),
    Column('sync_status', String, nullable=False),
    Column('error_message', Text),
    Column('synced_at', Text, nullable=False),
)

metadata.create_all(engine)

# In-memory session history: { child_id: [{ composite, task, passive, ts }, ...] }
session_history: dict = {}
# In-memory baselines: { child_id: float }
child_baselines: dict = {}


def _now_text() -> str:
    return datetime.utcnow().isoformat()


def _local_date_time() -> tuple[str, str]:
    local_now = datetime.utcnow()
    return local_now.strftime('%Y-%m-%d'), local_now.strftime('%H:%M:%S')


def _upsert_child_state(conn, child_id: str, baseline_score: float, total_sessions: int):
    existing = conn.execute(
        select(pages_children.c.child_id).where(pages_children.c.child_id == child_id)
    ).first()

    child_values = {
        'res_id': 'UNKNOWN',
        'grade': 3,
        'camp_id': os.getenv('CAMP_ID', 'CAMP-UNKNOWN'),
        'zone_id': None,
        'language': 'si',
        'enrolled_at': _now_text(),
        'total_sessions': total_sessions,
        'baseline_score': baseline_score,
        'consecutive_low': 0,
        'sdq_band': 'unknown',
        'alert_status': 'none',
        'synced': 1,
    }

    if existing:
        conn.execute(
            update(pages_children)
            .where(pages_children.c.child_id == child_id)
            .values(
                baseline_score=baseline_score,
                total_sessions=total_sessions,
            )
        )
    else:
        conn.execute(
            insert(pages_children).values(child_id=child_id, **child_values)
        )


def _load_history():
    """Load history and baselines from the SQL database on startup."""
    global session_history, child_baselines

    session_history = {}
    child_baselines = {}

    try:
        with engine.connect() as conn:
            child_rows = conn.execute(
                select(
                    pages_children.c.child_id,
                    pages_children.c.baseline_score,
                    pages_children.c.total_sessions,
                )
            ).mappings().all()

            for row in child_rows:
                child_baselines[row['child_id']] = float(row['baseline_score'] or BASELINE_INIT)
                session_history.setdefault(row['child_id'], [])

            session_rows = conn.execute(
                select(
                    pages_sessions.c.child_id,
                    pages_sessions.c.session_id,
                    pages_sessions.c.composite_score,
                    pages_sessions.c.task_score,
                    pages_sessions.c.passive_score,
                    pages_sessions.c.created_at,
                )
                .where(pages_sessions.c.composite_score.is_not(None))
                .order_by(pages_sessions.c.child_id, pages_sessions.c.created_at)
            ).mappings().all()

            for row in session_rows:
                session_history.setdefault(row['child_id'], []).append({
                    'session_id': row['session_id'],
                    'composite': float(row['composite_score'] or 0),
                    'task': float(row['task_score'] or 0),
                    'passive': float(row['passive_score'] or 0),
                    'ts': row['created_at'] or _now_text(),
                })

            total_sessions = sum(len(v) for v in session_history.values())
            logger.info(
                f'[INIT] ✓ Loaded history from database: {len(session_history)} children, '
                f'{total_sessions} total sessions'
            )
    except Exception as e:
        logger.error(f'[INIT] ❌ Could not load history from database: {e}')
        session_history = {}
        child_baselines = {}


def _persist_score_result(
    child_id: str,
    session_id: str,
    task_metrics: dict,
    passive_signals: dict,
    composite_score: float,
    task_score: float,
    passive_score: float,
    z_score: float | None,
    if_score: float | None,
    anomaly_flagged: bool,
    gate_decision: str,
    baseline_before: float,
    baseline_after: float,
):
    session_count = len(session_history.get(child_id, [])) + 1
    session_date, session_time = _local_date_time()
    created_at = _now_text()
    signal_id = f'{session_id}-signals'
    decision_id = f'{session_id}-gate-1'

    signal_values = {
        'signal_id': signal_id,
        'session_id': session_id,
        'child_id': child_id,
        'accuracy_rate': float(task_metrics.get('accuracyRate', 0)),
        'false_tap_rate': float(task_metrics.get('falseTapRate', 0)),
        'avg_reaction_time': float(task_metrics.get('avgReactionTime', 0)),
        'reaction_variance': float(task_metrics.get('reactionVariance', 0)),
        'idle_time_ratio': float(passive_signals.get('idleTimeRatio', 0)),
        'rapid_click_count': int(passive_signals.get('rapidClickCount', 0) or 0),
        'time_to_first_ms': float(passive_signals.get('timeToFirstMs', 0)),
        'completion_ratio': float(passive_signals.get('completionRatio', 0)),
        'synced': 1,
    }

    session_values = {
        'session_id': session_id,
        'child_id': child_id,
        'content_session_id': None,
        'session_date': session_date,
        'session_time': session_time,
        'condition_label': 'A',
        'composite_score': composite_score,
        'task_score': task_score,
        'passive_score': passive_score,
        'baseline_score_used': baseline_before,
        'gate_decision': gate_decision,
        'second_gate_score': None,
        'cognitive_score': None,
        'session_complete': 0,
        'anomaly_flagged': 1 if anomaly_flagged else 0,
        'z_score': z_score,
        'if_score': if_score,
        'alert_triggered': 0,
        'synced': 1,
        'created_at': created_at,
    }

    decision_values = {
        'decision_id': decision_id,
        'session_id': session_id,
        'child_id': child_id,
        'attempt_number': 1,
        'composite_score': composite_score,
        'decision': gate_decision,
        'decided_at': created_at,
        'synced': 1,
    }

    with engine.begin() as conn:
        conn.execute(insert(pages_behavioral_signals).values(**signal_values))

        existing_session = conn.execute(
            select(pages_sessions.c.session_id).where(pages_sessions.c.session_id == session_id)
        ).first()

        if existing_session:
            conn.execute(
                update(pages_sessions)
                .where(pages_sessions.c.session_id == session_id)
                .values(**session_values)
            )
        else:
            conn.execute(insert(pages_sessions).values(**session_values))

        existing_decision = conn.execute(
            select(pages_gate_decisions.c.decision_id).where(pages_gate_decisions.c.decision_id == decision_id)
        ).first()

        if not existing_decision:
            conn.execute(insert(pages_gate_decisions).values(**decision_values))

        _upsert_child_state(conn, child_id, baseline_after, session_count)


def _load_child_history_from_db(child_id: str):
    with engine.connect() as conn:
        child_row = conn.execute(
            select(pages_children.c.baseline_score, pages_children.c.total_sessions)
            .where(pages_children.c.child_id == child_id)
        ).mappings().first()

        session_rows = conn.execute(
            select(
                pages_sessions.c.session_id,
                pages_sessions.c.composite_score,
                pages_sessions.c.task_score,
                pages_sessions.c.passive_score,
                pages_sessions.c.created_at,
            )
            .where(pages_sessions.c.child_id == child_id)
            .where(pages_sessions.c.composite_score.is_not(None))
            .order_by(pages_sessions.c.created_at)
        ).mappings().all()

    history = [
        {
            'session_id': row['session_id'],
            'composite': float(row['composite_score'] or 0),
            'task': float(row['task_score'] or 0),
            'passive': float(row['passive_score'] or 0),
            'ts': row['created_at'] or _now_text(),
        }
        for row in session_rows
    ]
    baseline = float((child_row or {}).get('baseline_score') or BASELINE_INIT)
    return history, baseline


def _load_history_entrypoint():
    _load_history()


_load_history_entrypoint()


# ── Scoring functions ─────────────────────────────────────────────────────────

def compute_task_score(task_metrics: dict) -> float:
    """
    Compute task score (0-100) from Go/No-Go behavioral metrics.
    Identical formula to Node.js fallback in scoringService.js.
    """
    accuracy_rate    = float(task_metrics.get('accuracyRate',    0))
    false_tap_rate   = float(task_metrics.get('falseTapRate',    0))
    avg_rt           = float(task_metrics.get('avgReactionTime', 800))
    rt_variance      = float(task_metrics.get('reactionVariance', 500))

    score = (
        accuracy_rate                                      * 100 * TASK_ACCURACY_W   +
        (1 - false_tap_rate)                               * 100 * TASK_FALSE_TAP_W  +
        max(0, 1 - avg_rt     / RT_NORM_BASE)              * 100 * TASK_RT_W         +
        max(0, 1 - rt_variance/ VARIANCE_NORM_BASE)        * 100 * TASK_VARIANCE_W
    )
    return round(min(max(score, 0), 100), 2)


def compute_passive_score(passive_signals: dict) -> float:
    """
    Compute passive score (0-100) from background interaction signals.
    """
    idle_ratio     = float(passive_signals.get('idleTimeRatio',    0))
    rapid_clicks   = float(passive_signals.get('rapidClickCount',  0))
    completion     = float(passive_signals.get('completionRatio',  1))

    score = (
        (1 - idle_ratio)                                   * 100 * PASSIVE_IDLE_W       +
        max(0, 1 - rapid_clicks / RAPID_CLICKS_BASE)       * 100 * PASSIVE_CLICKS_W     +
        completion                                          * 100 * PASSIVE_COMPLETION_W
    )
    return round(min(max(score, 0), 100), 2)


def compute_composite(task_score: float,
                      passive_score: float,
                      baseline: float) -> float:
    """
    Composite = task×0.50 + passive×0.30 + baseline×0.20
    As specified in proposal Section 3.2.3
    """
    score = (
        task_score    * 0.50 +
        passive_score * 0.30 +
        baseline      * 0.20
    )
    return round(min(max(score, 0.0), 100.0), 2)


def compute_z_score(child_id: str,
                    composite: float) -> float | None:

    history = session_history.get(child_id, [])
    prev_scores = [s['composite'] for s in history]

    # Need minimum 2 previous sessions
    # This means Z-Score activates on session 3
    if len(prev_scores) < 2:
        return None

    n    = len(prev_scores)
    mean = sum(prev_scores) / n

    # Population standard deviation
    variance = sum((x - mean) ** 2 for x in prev_scores) / n

    # Minimum std dev of 1.0 prevents division by zero
    # when all previous sessions have identical scores
    std = math.sqrt(variance) if variance > 0 else 1.0

    z = (composite - mean) / std

    logger.info(
        f'[ZSCORE] {child_id}: '
        f'z={z:.4f} current={composite:.2f} '
        f'mean={mean:.2f} std={std:.2f} '
        f'n={n} previous sessions'
    )

    return round(z, 4)


def _session_to_feature_vector(session: dict) -> list[float]:
    """Map a saved session into IF feature vector format."""
    return [
        float(session.get('composite', 0)),
        float(session.get('task', 0)),
        float(session.get('passive', 0)),
    ]


def train_if_model(child_id: str, include_current: list[float] | None = None):

    if not NUMPY_AVAILABLE or not SKLEARN_AVAILABLE:
        logger.warning('[IF] Cannot train model: numpy/sklearn not installed')
        return None

    history = session_history.get(child_id, [])
    features = [_session_to_feature_vector(session) for session in history]

    if include_current is not None:
        features.append(include_current)

    if len(features) < IF_MIN_SESSIONS:
        logger.info(
            f'[IF] {child_id}: Need {IF_MIN_SESSIONS} sessions for training, have {len(features)}'
        )
        return None

    # Keep the latest 50 sessions for model freshness and bounded training cost.
    features = features[-50:]

    try:
        X = np.array(features)
        logger.info(f'[IF] {child_id}: Training on {X.shape[0]} sessions with features shape {X.shape}')

        model = IsolationForest(
            contamination=0.1,
            random_state=42,
            n_estimators=100,
        )
        model.fit(X)

        model_path = MODELS_DIR / f'{child_id}.pkl'
        with open(model_path, 'wb') as f:
            pickle.dump(model, f)

        logger.info(f'[IF] ✓ {child_id}: Model trained/updated at {model_path}')
        return model

    except Exception as e:
        logger.error(f'[IF] ❌ {child_id}: Training failed: {e}')
        return None


def compute_if_score(child_id: str,
                     current_composite: float,
                     current_task: float,
                     current_passive: float) -> float | None:

    if not NUMPY_AVAILABLE or not SKLEARN_AVAILABLE:
        logger.debug(f'[IF] {child_id}: numpy/sklearn not available')
        return None

    history = session_history.get(child_id, [])
    total_sessions_after_current = len(history) + 1

    if total_sessions_after_current < IF_MIN_SESSIONS:
        return None

    current_feature = [
        float(current_composite),
        float(current_task),
        float(current_passive),
    ]

    model_path = MODELS_DIR / f'{child_id}.pkl'
    model = None

    # Ensure the model is created at session 8 and updated automatically on later sessions.
    if total_sessions_after_current >= IF_MIN_SESSIONS:
        model = train_if_model(child_id, include_current=current_feature)

    # Fallback: if training failed but existing model exists, keep serving scores.
    if model is None and model_path.exists():
        try:
            with open(model_path, 'rb') as f:
                model = pickle.load(f)
            logger.warning(f'[IF] {child_id}: Using existing model after retrain failure')
        except Exception as e:
            logger.error(f'[IF] ❌ {child_id}: Could not load existing model: {e}')
            return None

    if model is None:
        return None

    try:
        feature_vector = np.array([current_feature])
        if_score = float(model.score_samples(feature_vector)[0])
        logger.info(f'[IF] {child_id}: ✓ IF score computed = {if_score:.4f}')
        return round(if_score, 4)
    except Exception as e:
        logger.error(f'[IF] ❌ {child_id}: Could not compute IF score: {e}')
        return None


def update_history(child_id: str, composite: float, task: float, passive: float):
    """Add session result to child history and update rolling baseline."""
    if child_id not in session_history:
        session_history[child_id] = []
        logger.info(f'[HISTORY] {child_id}: First session, creating history')

    session_history[child_id].append({
        'composite': composite,
        'task':      task,
        'passive':   passive,
        'ts':        datetime.utcnow().isoformat(),
    })
    
    new_count = len(session_history[child_id])
    logger.info(f'[HISTORY] {child_id}: Session #{new_count} added (score={composite})')

    # Keep last 50 sessions in memory (more than enough for IF)
    session_history[child_id] = session_history[child_id][-50:]

    # Rolling baseline
    old_baseline = child_baselines.get(child_id, BASELINE_INIT)
    new_baseline = round(old_baseline * (1 - BASELINE_ALPHA) + composite * BASELINE_ALPHA, 2)
    child_baselines[child_id] = new_baseline
    
    logger.info(f'[HISTORY] {child_id}: Baseline updated {old_baseline} → {new_baseline}')

    return new_baseline


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    """Health check — called by Node.js to confirm Flask is alive."""
    history_count = sum(len(v) for v in session_history.values())
    return jsonify({
        'status':          'ok',
        'service':         'PAGES ML Scoring Service',
        'children_tracked': len(session_history),
        'total_sessions':  history_count,
        'numpy':           NUMPY_AVAILABLE,
        'sklearn':         SKLEARN_AVAILABLE,
        'time':            datetime.utcnow().isoformat(),
    })


@app.route('/score', methods=['POST'])
def score():
    """
    Main scoring endpoint.
    Called by Node.js scoringService.js after every 90-second game.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400

    child_id       = data.get('child_id',     'unknown')
    session_id     = data.get('session_id',   'unknown')
    task_metrics   = data.get('taskMetrics',   {})
    passive_signals = data.get('passiveSignals', {})

    if not task_metrics or not passive_signals:
        return jsonify({'error': 'taskMetrics and passiveSignals are required'}), 400

    # DEBUG: Show current history state at request start
    current_history = session_history.get(child_id, [])
    baseline_before = child_baselines.get(child_id, BASELINE_INIT)
    logger.info(f'[SCORE] ════════════════════════════════════════')
    logger.info(f'[SCORE] REQUEST: child={child_id} session={session_id[:8]}...')
    logger.info(f'[SCORE] Current history size: {len(current_history)} sessions')
    if current_history:
        scores = [s['composite'] for s in current_history]
        logger.info(f'[SCORE] Scores in memory: {scores}')

    # 1. Compute scores
    task_score    = compute_task_score(task_metrics)
    passive_score = compute_passive_score(passive_signals)
    baseline      = child_baselines.get(child_id, BASELINE_INIT)
    composite     = compute_composite(task_score, passive_score, baseline)

    # 2. Z-score (from session 3 onwards)
    z_score = compute_z_score(child_id, composite)

    # 3. Isolation Forest score (from session 8 onwards, model auto-created/updated)
    if_score = compute_if_score(child_id, composite, task_score, passive_score)

    # 4. Anomaly detection
    anomaly_by_z  = z_score  is not None and z_score  < ZSCORE_THRESHOLD
    anomaly_by_if = if_score is not None and if_score < IF_SCORE_THRESHOLD
    anomaly_flagged = anomaly_by_z or anomaly_by_if

    # 5. Gate decision
    gate_decision = 'PASS' if composite >= GATE_THRESHOLD else 'FAIL_FIRST'

    # 6. Persist to PostgreSQL/SQLite source of truth
    new_baseline = round(
        baseline_before * (1 - BASELINE_ALPHA) + composite * BASELINE_ALPHA,
        2,
    )
    try:
        _persist_score_result(
            child_id=child_id,
            session_id=session_id,
            task_metrics=task_metrics,
            passive_signals=passive_signals,
            composite_score=composite,
            task_score=task_score,
            passive_score=passive_score,
            z_score=z_score,
            if_score=if_score,
            anomaly_flagged=anomaly_flagged,
            gate_decision=gate_decision,
            baseline_before=baseline_before,
            baseline_after=new_baseline,
        )
    except Exception as e:
        logger.error(f'[DB] ❌ Could not persist score for child={child_id} session={session_id}: {e}')
        return jsonify({'error': 'Failed to persist scoring result'}), 500

    # 7. Update in-memory cache after persistence succeeds
    new_baseline = update_history(child_id, composite, task_score, passive_score)

    logger.info(
        f'[SCORE] child={child_id} composite={composite} task={task_score} passive={passive_score} '
        f'z={z_score} if={if_score} anomaly={anomaly_flagged} gate={gate_decision}'
    )

    # Response must match scoringService.js contract exactly
    return jsonify({
        'compositeScore': composite,
        'taskScore':      task_score,
        'passiveScore':   passive_score,
        'baselineScore':  new_baseline,
        'zScore':         z_score,
        'ifScore':        if_score,
        'anomalyFlagged': anomaly_flagged,
        'gateDecision':   gate_decision,
    })


@app.route('/history/<child_id>', methods=['GET'])
def get_history(child_id):
    """Debug endpoint — view session history for a child."""
    history, baseline = _load_child_history_from_db(child_id)
    return jsonify({
        'child_id':        child_id,
        'baseline':        baseline,
        'session_count':   len(history),
        'sessions':        history,
        'z_score_active':  len(history) >= ZSCORE_MIN_SESSIONS,
        'if_score_active': len(history) >= IF_MIN_SESSIONS,
    })


@app.route('/reset/<child_id>', methods=['POST'])
def reset_child(child_id):
    """Reset history for a child (for testing only)."""
    with engine.begin() as conn:
        conn.execute(delete(pages_behavioral_signals).where(pages_behavioral_signals.c.child_id == child_id))
        conn.execute(delete(pages_gate_decisions).where(pages_gate_decisions.c.child_id == child_id))
        conn.execute(delete(pages_sessions).where(pages_sessions.c.child_id == child_id))

        existing_child = conn.execute(
            select(pages_children.c.child_id).where(pages_children.c.child_id == child_id)
        ).first()

        if existing_child:
            conn.execute(
                update(pages_children)
                .where(pages_children.c.child_id == child_id)
                .values(
                    baseline_score=BASELINE_INIT,
                    total_sessions=0,
                    alert_status='none',
                )
            )

    session_history.pop(child_id, None)
    child_baselines.pop(child_id, None)
    return jsonify({'success': True, 'message': f'History reset for {child_id}'})


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5001))
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'

    logger.info('════════════════════════════════════════')
    logger.info('  PAGES ML Scoring Service')
    logger.info(f'  Port:             {port}')
    logger.info(f'  Gate threshold:   {GATE_THRESHOLD}')
    logger.info(f'  Z-score from:     session {ZSCORE_MIN_SESSIONS}')
    logger.info(f'  IF model from:    session {IF_MIN_SESSIONS}')
    logger.info(f'  numpy available:  {NUMPY_AVAILABLE}')
    logger.info(f'  sklearn available:{SKLEARN_AVAILABLE}')
    logger.info(f'  Database backend: {engine.url.drivername}')
    logger.info(f'  Models dir:       {MODELS_DIR}')
    logger.info('════════════════════════════════════════')

    app.run(
        host='0.0.0.0',     # cloud-hosted scorer must be reachable from Raspberry backend
        port=port,
        debug=debug,
        threaded=True,
    )
