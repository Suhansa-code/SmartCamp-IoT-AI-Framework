import os
import json
import math
import pickle
import logging
from pathlib import Path
from datetime import datetime

from flask import Flask, request, jsonify

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

# ── Persistence paths ─────────────────────────────────────────────────────────
# Session history stored in-memory during run; written to JSON for persistence
DATA_DIR    = Path(os.getenv('DATA_DIR',    './data'))
MODELS_DIR  = Path(os.getenv('MODELS_DIR',  './models'))
HISTORY_FILE = DATA_DIR / 'session_history.json'

DATA_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

# In-memory session history: { child_id: [{ composite, task, passive, ts }, ...] }
session_history: dict = {}
# In-memory baselines: { child_id: float }
child_baselines: dict = {}


def _load_history():
    """Load persisted session history from disk on startup."""
    global session_history, child_baselines
    logger.info(f'[INIT] History file path: {HISTORY_FILE}')
    logger.info(f'[INIT] File exists: {HISTORY_FILE.exists()}')
    
    if HISTORY_FILE.exists():
        try:
            data = json.loads(HISTORY_FILE.read_text())
            session_history = data.get('sessions', {})
            child_baselines = data.get('baselines', {})
            
            total_sessions = sum(len(v) for v in session_history.values())
            logger.info(f'[INIT] ✓ Loaded history: {len(session_history)} children, {total_sessions} total sessions')
            
            # Log each child's session count
            for cid, sessions in session_history.items():
                scores = [s.get('composite', 0) for s in sessions]
                logger.info(f'[INIT]   {cid}: {len(sessions)} sessions, scores={scores}')
        except Exception as e:
            logger.error(f'[INIT] ❌ Could not load history: {e}')
            session_history = {}
            child_baselines = {}
    else:
        logger.info(f'[INIT] History file does not exist yet')


def _save_history():
    """Persist session history to disk after every scored session."""
    try:
        HISTORY_FILE.write_text(json.dumps({
            'sessions':  session_history,
            'baselines': child_baselines,
            'saved_at':  datetime.utcnow().isoformat(),
        }, indent=2))
        
        # DEBUG: Verify what was saved
        total_sessions = sum(len(v) for v in session_history.values())
        logger.info(f'[SAVE] ✓ History saved: {len(session_history)} children, {total_sessions} total sessions')
    except Exception as e:
        logger.error(f'[SAVE] ❌ Could not save history: {e}')


_load_history()


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

    # 2. Z-score moved to Node.js — Flask returns null
    z_score = None

    # 3. Isolation Forest score (from session 8 onwards, model auto-created/updated)
    if_score = compute_if_score(child_id, composite, task_score, passive_score)

    # 4. Anomaly detection (IF only)
    anomaly_by_if = if_score is not None and if_score < IF_SCORE_THRESHOLD
    anomaly_flagged = anomaly_by_if

    # 5. Update history AFTER computing z-score (so this session isn't compared to itself)
    new_baseline = update_history(child_id, composite, task_score, passive_score)

    # 6. Gate decision
    gate_decision = 'PASS' if composite >= GATE_THRESHOLD else 'FAIL_FIRST'

    # 7. Persist history to disk
    _save_history()

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
    history  = session_history.get(child_id, [])
    baseline = child_baselines.get(child_id, BASELINE_INIT)
    return jsonify({
        'child_id':        child_id,
        'baseline':        baseline,
        'session_count':   len(history),
        'sessions':        history,
        'z_score_active':  False,  # Z-score now computed in Node.js
        'if_score_active': len(history) >= IF_MIN_SESSIONS,
    })


@app.route('/reset/<child_id>', methods=['POST'])
def reset_child(child_id):
    """Reset history for a child (for testing only)."""
    session_history.pop(child_id, None)
    child_baselines.pop(child_id, None)
    _save_history()
    return jsonify({'success': True, 'message': f'History reset for {child_id}'})


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5001))
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'

    logger.info('════════════════════════════════════════')
    logger.info('  PAGES ML Scoring Service')
    logger.info(f'  Port:             {port}')
    logger.info(f'  Gate threshold:   {GATE_THRESHOLD}')
    logger.info(f'  Z-score:          computed in Node.js (session {ZSCORE_MIN_SESSIONS})')
    logger.info(f'  IF model from:    session {IF_MIN_SESSIONS}')
    logger.info(f'  numpy available:  {NUMPY_AVAILABLE}')
    logger.info(f'  sklearn available:{SKLEARN_AVAILABLE}')
    logger.info(f'  History file:     {HISTORY_FILE}')
    logger.info(f'  Models dir:       {MODELS_DIR}')
    logger.info('════════════════════════════════════════')

    app.run(
        host='0.0.0.0',   # reachable from other containers on the compose network
        port=port,
        debug=debug,
        threaded=True,
    )
