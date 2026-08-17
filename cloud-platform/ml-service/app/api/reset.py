from flask import Blueprint, current_app, jsonify

bp = Blueprint('reset', __name__)


@bp.route('/reset/<child_id>', methods=['POST'])
def reset_child(child_id):
    """Reset history for a child (for testing only)."""
    history = current_app.extensions['history']
    history.reset_child(child_id)
    return jsonify({'success': True, 'message': f'History reset for {child_id}'})