import argparse, json, pickle, logging
from pathlib import Path
 
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
 
MIN_SESSIONS  = 8
CONTAMINATION = 0.10   # expect ~10% of sessions anomalous
 
 
def load_history():
    f = DATA_DIR / 'session_history.json'
    if not f.exists():
        log.error(f'Not found: {f}')
        return {}
    return json.loads(f.read_text()).get('sessions', {})
 
 
def train(child_id, sessions):
    n = len(sessions)
    if n < MIN_SESSIONS:
        log.warning(f'{child_id}: {n} sessions — need {MIN_SESSIONS}. Skipped.')
        return False
 
    X = np.array([[s['composite'], s['task'], s['passive']] for s in sessions])
 
    model = IsolationForest(n_estimators=100, contamination=CONTAMINATION,
                            random_state=42, max_samples='auto')
    model.fit(X)
 
    path = MODELS_DIR / f'{child_id}.pkl'
    with open(path, 'wb') as f:
        pickle.dump(model, f)
 
    scores    = model.score_samples(X)
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
 
    history = load_history()
    if not history:
        log.error('No history found. Add session_history.json to data/ first.')
        return
 
    if args.child:
        sessions = history.get(args.child)
        if not sessions:
            log.error(f'{args.child} not found in history.')
            return
        train(args.child, sessions)
        return
 
    # --all
    ok = skip = 0
    for child_id, sessions in sorted(history.items()):
        if train(child_id, sessions): ok += 1
        else: skip += 1
    log.info(f'Done — trained: {ok}  skipped: {skip}')
 
 
if __name__ == '__main__':
    main()
 