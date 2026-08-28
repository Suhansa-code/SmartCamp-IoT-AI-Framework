import os
from pathlib import Path


class Config:
    """Application configuration, loaded from environment variables."""

    # ── HTTP server ────────────────────────────────────────────────
    FLASK_PORT = int(os.getenv('FLASK_PORT', '5001'))
    FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'

    # ── Scoring thresholds ─────────────────────────────────────────
    GATE_THRESHOLD = float(os.getenv('GATE_THRESHOLD', '55'))
    BASELINE_ALPHA = float(os.getenv('BASELINE_ALPHA', '0.20'))
    BASELINE_INIT = float(os.getenv('BASELINE_INIT', '60.0'))
    ZSCORE_THRESHOLD = float(os.getenv('ZSCORE_THRESHOLD', '-2.0'))
    IF_SCORE_THRESHOLD = float(os.getenv('IF_SCORE_THRESHOLD', '-0.10'))
    ZSCORE_MIN_SESSIONS = int(os.getenv('ZSCORE_MIN_SESSIONS', '3'))
    IF_MIN_SESSIONS = int(os.getenv('IF_MIN_SESSIONS', '8'))

    # ── Scoring weights (match Node.js fallback formula) ───────────
    TASK_ACCURACY_W = 0.40
    TASK_FALSE_TAP_W = 0.30
    TASK_RT_W = 0.15
    TASK_VARIANCE_W = 0.15

    PASSIVE_IDLE_W = 0.35
    PASSIVE_CLICKS_W = 0.25
    PASSIVE_COMPLETION_W = 0.40

    COMPOSITE_TASK_W = 0.60
    COMPOSITE_PASSIVE_W = 0.40

    # Normalisation baselines
    RT_NORM_BASE = 800       # ms — reaction time above this scores 0
    VARIANCE_NORM_BASE = 500 # ms — variance above this scores 0
    RAPID_CLICKS_BASE = 10   # count above this scores 0

    # ── Persistence paths ──────────────────────────────────────────
    DATA_DIR = Path(os.getenv('DATA_DIR', './data'))
    MODELS_DIR = Path(os.getenv('MODELS_DIR', './models'))
    SQLITE_PATH = Path(os.getenv('SQLITE_PATH', './data/pages.db'))
    CAMP_ID = os.getenv('CAMP_ID', os.getenv('DEVICE_ID', 'CAMP-UNKNOWN'))

    # ── Database ───────────────────────────────────────────────────
    POSTGRES_URL = os.getenv('POSTGRES_URL') or None
    POSTGRES_USER = os.getenv('POSTGRES_USER')
    POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', '')
    POSTGRES_DB = os.getenv('POSTGRES_DB')

    @classmethod
    def database_url(cls) -> str:
        postgres_url = cls.POSTGRES_URL
        if postgres_url:
            if postgres_url.startswith(('postgresql://', 'postgresql+psycopg2://', 'sqlite://')):
                return postgres_url

            postgres_user = cls.POSTGRES_USER
            postgres_password = cls.POSTGRES_PASSWORD
            postgres_db = cls.POSTGRES_DB
            postgres_host = postgres_url

            if postgres_user and postgres_db:
                auth = f'{postgres_user}:{postgres_password}@' if postgres_password else f'{postgres_user}@'
                return f'postgresql+psycopg2://{auth}{postgres_host}/{postgres_db}'

        return f'sqlite:///{cls.SQLITE_PATH.as_posix()}'