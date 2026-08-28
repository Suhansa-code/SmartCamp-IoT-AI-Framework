from flask import Blueprint, current_app, jsonify

from ..services import if_service

bp = Blueprint('insights', __name__)


@bp.route('/insights/<child_id>', methods=['GET'])
def get_child_insights(child_id):
    """Get IF prediction insights for a child (for cloud dashboard)."""
    engine = current_app.extensions['engine']
    insights = if_service.get_child_insights(engine, child_id)

    return jsonify({
        'child_id': child_id,
        'insight_count': len(insights),
        'insights': insights,
    })


@bp.route('/insights/<child_id>/summary', methods=['GET'])
def get_insight_summary(child_id):
    """Get aggregated IF insights summary for a child."""
    engine = current_app.extensions['engine']
    insights = if_service.get_child_insights(engine, child_id, limit=100)

    if not insights:
        return jsonify({
            'child_id': child_id,
            'total_sessions': 0,
            'anomaly_count': 0,
            'anomaly_rate': 0,
            'avg_if_score': None,
            'latest_if_score': None,
            'if_score_trend': None,
        })

    anomaly_count = sum(1 for i in insights if i.get('anomaly_flagged'))
    if_scores = [i['if_score'] for i in insights if i.get('if_score') is not None]
    avg_if_score = round(sum(if_scores) / len(if_scores), 4) if if_scores else None
    latest_if_score = if_scores[0] if if_scores else None

    trend = None
    if len(if_scores) >= 2:
        trend = round(if_scores[0] - if_scores[-1], 4)

    return jsonify({
        'child_id': child_id,
        'total_sessions': len(insights),
        'anomaly_count': anomaly_count,
        'anomaly_rate': round(anomaly_count / len(insights) * 100, 2),
        'avg_if_score': avg_if_score,
        'latest_if_score': latest_if_score,
        'if_score_trend': trend,
    })


@bp.route('/models', methods=['GET'])
def get_all_models():
    """Get summary of all IF models (admin dashboard)."""
    engine = current_app.extensions['engine']
    models = if_service.get_all_models_summary(engine)

    return jsonify({
        'model_count': len(models),
        'models': models,
    })


@bp.route('/models/<child_id>', methods=['GET'])
def get_model_info(child_id):
    """Get model metadata for a child."""
    engine = current_app.extensions['engine']
    model_info = if_service.get_model_info(engine, child_id)

    if not model_info:
        return jsonify({'error': f'No model found for child {child_id}'}), 404

    return jsonify(model_info)
