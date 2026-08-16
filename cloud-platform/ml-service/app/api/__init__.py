from flask import Blueprint


def register_blueprints(app):
    from .health import bp as health_bp
    from .history import bp as history_bp
    from .reset import bp as reset_bp
    from .score import bp as score_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(score_bp)
    app.register_blueprint(history_bp)
    app.register_blueprint(reset_bp)


# Re-export Blueprint for consistent import shape
__all__ = ['Blueprint', 'register_blueprints']