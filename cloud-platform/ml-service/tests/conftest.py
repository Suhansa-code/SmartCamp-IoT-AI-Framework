import os
import sys
import tempfile
from pathlib import Path

import pytest

# ── Isolate runtime paths before any app module is imported ──────────────────
_TMP = tempfile.mkdtemp(prefix='ml-service-test-')
os.environ['SQLITE_PATH'] = os.path.join(_TMP, 'pages.db')
os.environ['DATA_DIR'] = _TMP
os.environ['MODELS_DIR'] = _TMP
os.environ['FLASK_DEBUG'] = 'false'
os.environ['POSTGRES_URL'] = ''

# Make the ml-service package importable regardless of CWD
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture()
def app():
    from app import create_app

    application = create_app()
    yield application
    # dispose engine + drop in-memory tables to keep tests isolated
    application.extensions['engine'].dispose()


@pytest.fixture()
def client(app):
    return app.test_client()