"""Application factory for the PAGES ML scoring service."""
import logging

from flask import Flask

from .config import Config
from .database import create_engine_for, metadata
from .services.history_service import HistoryService


def create_app(config: Config | None = None) -> Flask:
    cfg = config or Config()

    # ── Paths ──────────────────────────────────────────────────────
    cfg.DATA_DIR.mkdir(exist_ok=True)
    cfg.MODELS_DIR.mkdir(exist_ok=True)
    cfg.SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)

    # ── App + logging ──────────────────────────────────────────────
    app = Flask(__name__)
    app.config.from_object(cfg)

    if not logging.getLogger().handlers:
        logging.basicConfig(
            level=logging.INFO,
            format='[%(asctime)s] [%(levelname)s] %(message)s',
            datefmt='%Y-%m-%dT%H:%M:%S',
        )
    logger = logging.getLogger(__name__)

    # ── Database ───────────────────────────────────────────────────
    database_url = cfg.database_url()
    engine = create_engine_for(database_url)
    metadata.create_all(engine)

    # ── State ──────────────────────────────────────────────────────
    history = HistoryService(engine, cfg)
    history.load_from_db()

    app.extensions['config'] = cfg
    app.extensions['engine'] = engine
    app.extensions['history'] = history

    # ── Routes ─────────────────────────────────────────────────────
    from .api import register_blueprints
    register_blueprints(app)

    logger.info(
        'PAGES ML Scoring Service ready | db=%s | gate=%s | z from session %s | IF from session %s',
        engine.url.drivername,
        cfg.GATE_THRESHOLD,
        cfg.ZSCORE_MIN_SESSIONS,
        cfg.IF_MIN_SESSIONS,
    )

    return app