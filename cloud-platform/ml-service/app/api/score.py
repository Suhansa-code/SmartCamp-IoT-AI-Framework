from flask import Blueprint, current_app, jsonify, request

from ..services import scoring_service, if_service

bp = Blueprint('score', __name__)


@bp.route('/score', methods=['POST'])
def score():
    """
    Main scoring endpoint.
    Called by the Node.js backend after every 90-second game.
    """
    config = current_app.extensions['config']
    history = current_app.extensions['history']
    engine = current_app.extensions['engine']

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400

    child_id = data.get('child_id', 'unknown')
    session_id = data.get('session_id', 'unknown')
    task_metrics = data.get('taskMetrics', {})
    passive_signals = data.get('passiveSignals', {})

    if not task_metrics or not passive_signals:
        return jsonify({'error': 'taskMetrics and passiveSignals are required'}), 400

    # 1. Compute scores
    task_score = scoring_service.compute_task_score(task_metrics, config)
    passive_score = scoring_service.compute_passive_score(passive_signals, config)
    baseline = history.child_baselines.get(child_id, config.BASELINE_INIT)
    composite = scoring_service.compute_composite(task_score, passive_score, baseline, config)

    # 2. Z-score (from session 3 onwards)
    z_score = scoring_service.compute_z_score(child_id, composite, history.session_history, config)

    # 3. Isolation Forest score (from session 8 onwards)
    if_score = if_service.compute_if_score(
        child_id, task_metrics, passive_signals, history.session_history, config, engine
    )

    # 4. Anomaly detection
    anomaly_by_z = z_score is not None and z_score < config.ZSCORE_THRESHOLD
    anomaly_by_if = if_score is not None and if_score < config.IF_SCORE_THRESHOLD
    anomaly_flagged = anomaly_by_z or anomaly_by_if

    # 5. Gate decision
    gate_decision = 'PASS' if composite >= config.GATE_THRESHOLD else 'FAIL_FIRST'

    # 6. Persist to source of truth
    new_baseline = round(
        baseline * (1 - config.BASELINE_ALPHA) + composite * config.BASELINE_ALPHA,
        2,
    )
    try:
        history.persist_score_result(
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
            baseline_before=baseline,
            baseline_after=new_baseline,
        )
    except Exception as e:
        print(f'[DB] Could not persist score for child={child_id} session={session_id}: {e}')
        return jsonify({'error': 'Failed to persist scoring result'}), 500

    # 7. Save IF insight if score computed
    if if_score is not None:
        try:
            feature_vector = scoring_service.session_to_feature_vector({
                **task_metrics, **passive_signals,
            })
            contributions = {
                'composite': round(composite * 0.50, 2),
                'task': round(task_score * 0.30, 2),
                'passive': round(passive_score * 0.20, 2),
            }
            if_service.save_if_insight(
                engine, child_id, session_id, if_score, anomaly_by_if,
                composite, task_score, passive_score, contributions,
            )
        except Exception as e:
            print(f'[DB] Could not persist IF insight for child={child_id}: {e}')

    # 8. Update in-memory cache after persistence succeeds
    new_baseline = history.update_history(child_id, composite, task_score, passive_score)

    print(
        f'[SCORE] child={child_id} composite={composite} task={task_score} passive={passive_score} '
        f'z={z_score} if={if_score} anomaly={anomaly_flagged} gate={gate_decision}'
    )

    return jsonify({
        'compositeScore': composite,
        'taskScore': task_score,
        'passiveScore': passive_score,
        'baselineScore': new_baseline,
        'zScore': z_score,
        'ifScore': if_score,
        'anomalyFlagged': anomaly_flagged,
        'gateDecision': gate_decision,
    })
