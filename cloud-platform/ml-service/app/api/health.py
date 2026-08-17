from flask import Blueprint, jsonify

bp = Blueprint('health', __name__)


@bp.route('/health', methods=['GET'])
def health():
    """Health check — called by Node.js to confirm the ML service is alive."""
    from ..services import scoring_service

    history = _get_history()
    history_count = sum(len(v) for v in history.session_history.values())

    return jsonify({
        'status': 'ok',
        'service': 'PAGES ML Scoring Service',
        'children_tracked': len(history.session_history),
        'total_sessions': history_count,
        'numpy': scoring_service.NUMPY_AVAILABLE,
        'sklearn': scoring_service.SKLEARN_AVAILABLE,
        'time': _now_text(),
    })


def _get_history():
    from flask import current_app
    return current_app.extensions['history']


def _now_text():
    from datetime import datetime
    return datetime.utcnow().isoformat()