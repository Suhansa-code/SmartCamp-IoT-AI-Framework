import argparse
import json
import pickle
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

try:
    import numpy as np
    from sklearn.ensemble import IsolationForest
except ImportError:
    logger.error('numpy and scikit-learn are required. Run: pip install numpy scikit-learn')
    exit(1)

DATA_DIR   = Path('./data')
MODELS_DIR = Path('./models')
MODELS_DIR.mkdir(exist_ok=True)

IF_MIN_SESSIONS = 8


def load_history() -> dict:
    history_file = DATA_DIR / 'session_history.json'
    if not history_file.exists():
        logger.error(f'History file not found: {history_file}')
        return {}
    data = json.loads(history_file.read_text())
    return data.get('sessions', {})


def train_for_child(child_id: str, sessions: list) -> bool:
    if len(sessions) < IF_MIN_SESSIONS:
        logger.warning(f'{child_id}: only {len(sessions)} sessions — need {IF_MIN_SESSIONS}. Skipping.')
        return False

    # Build feature matrix from session history
    # Note: historical sessions only store composite/task/passive — not raw metrics.
    # For a real deployment you would store the raw feature vector per session.
    # Here we reconstruct approximate features from the stored scores.
    # In production, store raw metrics in session_history to get exact features.
    features = []
    for s in sessions:
        composite = s.get('composite', 60)
        task      = s.get('task',      60)
        passive   = s.get('passive',   60)

        # Approximate the 7 feature vector from stored scores
        # These are rough inverses of the scoring formulas
        approx_accuracy   = min(1.0, task / 100 * 1.5)
        approx_false_tap  = max(0.0, 1 - task / 100)
        approx_rt         = max(200, 800 * (1 - (task - 30) / 70))
        approx_variance   = max(50, 500 * (1 - composite / 100))
        approx_idle       = max(0.0, 1 - passive / 100)
        approx_clicks     = max(0, int((1 - passive / 100) * 5))
        approx_completion = min(1.0, passive / 100 + 0.5)

        features.append([
            approx_accuracy,
            approx_false_tap,
            approx_rt,
            approx_variance,
            approx_idle,
            approx_clicks,
            approx_completion,
        ])

    X = np.array(features)

    # Train Isolation Forest
    # contamination=0.1 means we expect ~10% of sessions to be anomalous
    model = IsolationForest(
        n_estimators=100,
        contamination=0.10,
        random_state=42,
        max_samples='auto',
    )
    model.fit(X)

    # Save model
    model_path = MODELS_DIR / f'{child_id}.pkl'
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)

    logger.info(f'{child_id}: model trained on {len(sessions)} sessions → {model_path}')
    return True


def main():
    parser = argparse.ArgumentParser(description='Train Isolation Forest models for PAGES children')
    parser.add_argument('--child', type=str, help='Train for a specific child_id (e.g. B-001)')
    parser.add_argument('--all',   action='store_true', help='Train for all children with enough sessions')
    args = parser.parse_args()

    if not args.child and not args.all:
        parser.print_help()
        return

    history = load_history()
    if not history:
        logger.error('No session history found. Run some sessions first.')
        return

    if args.child:
        sessions = history.get(args.child, [])
        train_for_child(args.child, sessions)

    elif args.all:
        trained = 0
        skipped = 0
        for child_id, sessions in history.items():
            if train_for_child(child_id, sessions):
                trained += 1
            else:
                skipped += 1
        logger.info(f'Done. Trained: {trained}, Skipped (not enough data): {skipped}')


if __name__ == '__main__':
    main()
