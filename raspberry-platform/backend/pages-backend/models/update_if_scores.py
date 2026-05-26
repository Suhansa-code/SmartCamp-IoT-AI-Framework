import argparse, pickle, sqlite3, logging
import numpy as np
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')
log = logging.getLogger(__name__)

MODELS_DIR = Path("./models")

def update_child(child_id):
    path = MODELS_DIR / f"{child_id}.pkl"
    if not path.exists():
        log.warning(f"Model not found for {child_id}")
        return False

    model = pickle.load(open(path, "rb"))

    conn = sqlite3.connect("../database/pages.db")
    cursor = conn.cursor()
    cursor.execute("""
        SELECT session_id, accuracy_rate, false_tap_rate, avg_reaction_time,
               reaction_variance, idle_time_ratio, rapid_click_count,
               time_to_first_ms, completion_ratio
        FROM pages_behavioral_signals
        WHERE child_id = ?
        ORDER BY session_id
    """, (child_id,))
    rows = cursor.fetchall()

    if not rows:
        log.warning(f"No signals found for {child_id}")
        conn.close()
        return False

    X = np.array([r[1:] for r in rows])
    scores = model.score_samples(X)
    preds  = model.predict(X)

    updated = 0
    for idx, ((session_id, *features), score, pred) in enumerate(zip(rows, scores, preds), start=1):
        if idx < 8:
            # skip first 7 sessions
            continue
        anomaly = 1 if pred == -1 else 0
        cursor.execute("""
            UPDATE pages_sessions
            SET if_score = ?, anomaly_flagged = ?
            WHERE session_id = ?
        """, (float(score), anomaly, session_id))
        updated += 1

    conn.commit()
    conn.close()
    log.info(f"{child_id}: updated {updated} sessions (skipped first 7)")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--all',   action='store_true', help='Update all children 172–200')
    ap.add_argument('--child', type=str,            help='Update one child e.g. TEST-CHILD-000180')
    args = ap.parse_args()

    if not args.all and not args.child:
        ap.print_help(); return

    if args.child:
        update_child(args.child)
        return

    # --all restricted to 172–200
    conn = sqlite3.connect("../database/pages.db")
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT child_id FROM pages_behavioral_signals")
    child_ids = [row[0] for row in cursor.fetchall()]
    conn.close()

    ok = skip = 0
    for child_id in sorted(child_ids):
        try:
            num = int(child_id.replace("TEST-CHILD-",""))
        except ValueError:
            continue
        if 172 <= num <= 200:
            if update_child(child_id): ok += 1
            else: skip += 1
    log.info(f"Done — updated: {ok}  skipped: {skip}")


if __name__ == "__main__":
    main()
