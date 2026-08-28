"""Trigger endpoint — called by sync receiver after a session is synced.

Auto-triggers IF scoring in the cloud when criteria are met.
This keeps IF entirely cloud-side; the Pi never sees IF results.
"""
from flask import Blueprint, current_app, jsonify, request

from ..services import scoring_service, if_service

bp = Blueprint('trigger', __name__)


@bp.route('/trigger-if', methods=['POST'])
def trigger_if():
    """
    Called by cloud sync receiver after a session is synced.
    Expects: { child_id, session_id, composite_score, task_score, passive_score,
               taskMetrics, passiveSignals }
    Trains IF model if session 8+, computes anomaly score, saves insight.
    """
    config = current_app.extensions['config']
    history = current_app.extensions['history']
    engine = current_app.extensions['engine']

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400

    child_id = data.get('child_id')
    session_id = data.get('session_id')
    composite_score = data.get('composite_score')
    task_score = data.get('task_score')
    passive_score = data.get('passive_score')
    task_metrics = data.get('taskMetrics', {})
    passive_signals = data.get('passiveSignals', {})

    if not all([child_id, session_id, composite_score is not None]):
        return jsonify({'error': 'child_id, session_id, composite_score required'}), 400

    # Ensure child exists in history
    if child_id not in history.session_history:
        history.session_history[child_id] = []

    # Add this session to history for IF computation
    history.session_history[child_id].append({
        'session_id': session_id,
        'composite': float(composite_score),
        'task': float(task_score or 0),
        'passive': float(passive_score or 0),
    })

    # Keep last 50
    history.session_history[child_id] = history.session_history[child_id][-50:]

    # Compute IF score
    if_score = if_service.compute_if_score(
        child_id, task_metrics, passive_signals,
        history.session_history, config, engine,
    )

    # Save insight if IF scored
    anomaly_flagged = False
    if if_score is not None:
        anomaly_flagged = if_score < config.IF_SCORE_THRESHOLD
        try:
            contributions = {
                'composite': round(float(composite_score) * 0.50, 2),
                'task': round(float(task_score or 0) * 0.30, 2),
                'passive': round(float(passive_score or 0) * 0.20, 2),
            }
            if_service.save_if_insight(
                engine, child_id, session_id, if_score, anomaly_flagged,
                float(composite_score), float(task_score or 0), float(passive_score or 0),
                contributions,
            )
        except Exception as e:
            print(f'[TRIGGER] Could not save IF insight: {e}')

    # Update baseline
    history.update_history(child_id, float(composite_score), float(task_score or 0), float(passive_score or 0))

    print(f'[TRIGGER] child={child_id} session={session_id} if={if_score} anomaly={anomaly_flagged}')

    return jsonify({
        'child_id': child_id,
        'session_id': session_id,
        'if_score': if_score,
        'anomaly_flagged': anomaly_flagged,
    })
