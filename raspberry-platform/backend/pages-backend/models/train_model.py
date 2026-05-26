import argparse, pickle, logging
from pathlib import Path
import sqlite3

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')
log = logging.getLogger(__name__)

try:
    import numpy as np
    from sklearn.ensemble import IsolationForest
except ImportError:
    log.error('Run: pip install numpy scikit-learn')
    exit(1)

DATA_DIR   = Path('./data')
MODELS_DIR = Path('./models')
MODELS_DIR.mkdir(exist_ok=True)

MIN_SESSIONS = 8


def load_signals(child_id):
    """Load behavioral signals for one child from SQLite."""
    conn = sqlite3.connect("../database/pages.db")
    cursor = conn.cursor()
    cursor.execute("""
        SELECT accuracy_rate, false_tap_rate, avg_reaction_time,
               reaction_variance, idle_time_ratio, rapid_click_count,
               time_to_first_ms, completion_ratio
        FROM pages_behavioral_signals
        WHERE child_id = ?
        ORDER BY session_id
    """, (child_id,))
    rows = cursor.fetchall()
    conn.close()
    return rows


def train(child_id, signals):
    n = len(signals)
    if n < MIN_SESSIONS:
        log.warning(f'{child_id}: {n} sessions — need {MIN_SESSIONS}. Skipped.')
        return False

    X = np.array(signals)

    # contamination = fraction of FAIL sessions for this child
    conn = sqlite3.connect("../database/pages.db")
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*) FROM pages_sessions
        WHERE child_id = ? AND gate_decision IN ('FAIL_FIRST','FAIL_CONFIRMED')
    """, (child_id,))
    fail_count = cursor.fetchone()[0]
    conn.close()

    contamination = fail_count / n if fail_count > 0 else 0.01
    if contamination > 0.5:
        contamination = 0.5

    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42,
        max_samples='auto'
    )
    model.fit(X)

    path = MODELS_DIR / f'{child_id}.pkl'
    with open(path, 'wb') as f:
        pickle.dump(model, f)

    scores = model.score_samples(X)
    n_flagged = int((model.predict(X) == -1).sum())
    log.info(f'{child_id}: {n} sessions | '
             f'flagged {n_flagged}/{n} ({n_flagged/n:.0%}) | '
             f'scores [{scores.min():.3f}, {scores.max():.3f}] | saved → {path}')
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--all',   action='store_true', help='Train all eligible children')
    ap.add_argument('--child', type=str,            help='Train one child e.g. TEST-CHILD-000172')
    args = ap.parse_args()

    if not args.all and not args.child:
        ap.print_help(); return

    if args.child:
        signals = load_signals(args.child)
        if not signals:
            log.error(f'{args.child} not found in behavioral signals.')
            return
        train(args.child, signals)
        return

    # --all but restricted to 172–200
    conn = sqlite3.connect("../database/pages.db")
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT child_id FROM pages_behavioral_signals")
    child_ids = [row[0] for row in cursor.fetchall()]
    conn.close()

    ok = skip = 0
    for child_id in sorted(child_ids):
        # only keep IDs in the desired range
        try:
            num = int(child_id.replace("TEST-CHILD-",""))
        except ValueError:
            continue
        if 172 <= num <= 200:
            signals = load_signals(child_id)
            if train(child_id, signals): ok += 1
            else: skip += 1
    log.info(f'Done — trained: {ok}  skipped: {skip}')


if __name__ == '__main__':
    main()
