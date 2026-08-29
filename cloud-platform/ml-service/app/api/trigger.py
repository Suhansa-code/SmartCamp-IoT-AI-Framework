from flask import Blueprint, current_app, jsonify, request

from ..services import scoring_service, if_service

bp = Blueprint('trigger', __name__)


@bp.route('/trigger-if', methods=['POST'])
def trigger_if():

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

    if not all([child_id, session_id, composite_score is not None]):
        return jsonify({'error': 'child_id, session_id, composite_score required'}), 400

    # Ensure child exists in history
    if child_id not in history.session_history:
        history.session_history[child_id] = []

    # Current session data
    session_data = {
        'session_id': session_id,
        'composite': float(composite_score),
        'task': float(task_score or 0),
        'passive': float(passive_score or 0),
        **data.get('taskMetrics', {}),
        **data.get('passiveSignals', {}),
    }

    # 1. Compute IF score: Model trained ONLY on PREVIOUS sessions
    if_score = if_service.compute_if_score(
        child_id=child_id,
        current_session=session_data,
        history=history.session_history,
        config=config,
        engine=engine,
    )

    # 2. Save insight if IF scored
    anomaly_flagged = False
    raw_score = None
    decision_score = None

    if if_result is not None:
        raw_score = if_result['raw_score']
        decision_score = if_result['decision_score']

        anomaly_flagged = if_result['is_anomaly']

        try:
            contributions = {
                'composite': round(float(composite_score) * 0.50, 2),
                'task': round(float(task_score or 0) * 0.30, 2),
                'passive': round(float(passive_score or 0) * 0.20, 2),
            }
            if_service.save_if_insight(
                engine,
                child_id,
                session_id,
                decision_score,
                anomaly_flagged,
                float(composite_score),
                float(task_score or 0),
                float(passive_score or 0),
                contributions,
            )

        except Exception as e:
            print(f'[TRIGGER] Could not save IF insight: {e}')

    # 3. Append current session to history after scoring
    history.session_history[child_id].append(session_data)
    history.update_history(
        child_id,
        float(composite_score),
        float(task_score or 0),
        float(passive_score or 0)
    )

    # 4. Update baseline
    history.update_history(child_id, float(composite_score), float(task_score or 0), float(passive_score or 0))

    print(
        f'[TRIGGER] child={child_id} '
        f'session={session_id} '
        f'raw={raw_score} '
        f'decision={decision_score} '
        f'anomaly={anomaly_flagged}'
    )

    return jsonify({
        'child_id': child_id,
        'session_id': session_id,
        'raw_score': raw_score,
        'decision_score': decision_score,
        'anomaly_flagged': anomaly_flagged,
    })
