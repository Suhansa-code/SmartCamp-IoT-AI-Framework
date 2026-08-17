"""Entry point for the PAGES ML scoring service."""
import os

from app import create_app
from app.config import Config

app = create_app(Config())


if __name__ == '__main__':
    port = Config.FLASK_PORT
    debug = Config.FLASK_DEBUG

    app.run(
        host='0.0.0.0',  # cloud-hosted scorer must be reachable from the backend
        port=port,
        debug=debug,
        threaded=True,
    )