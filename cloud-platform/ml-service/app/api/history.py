from flask import Blueprint, current_app, jsonify

bp = Blueprint('history', __name__)


@bp.route('/history/<child_id>', methods=['GET'])
def get_history(child_id):
    """Debug endpoint — view session history for a child."""
    config = current_app.extensions['config']
    history = current_app.extensions['history']

    sessions, baseline = history.load_child_from_db(child_id)

    return jsonify({
        'child_id': child_id,
        'baseline': baseline,
        'session_count': len(sessions),
        'sessions': sessions,
        'z_score_active': len(sessions) >= config.ZSCORE_MIN_SESSIONS,
        'if_score_active': len(sessions) >= config.IF_MIN_SESSIONS,
    })