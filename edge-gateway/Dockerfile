# Edge Gateway — FastAPI service (:8000) for GPS, DHT11, rainfall,
# hydrospatial lookups, DEM elevation and XGBoost flood prediction.
#
# Builds for both linux/arm64 (the Pi, alongside the camp backend) and
# linux/amd64 (a NUC). raspberry-platform's backend reaches it via EDGE_API_URL.
#
# Pinned to 3.11 because rasterio, pyogrio, scikit-learn and xgboost all
# publish cp311 wheels, and a version without one falls back to a source build
# needing GDAL/GEOS/PROJ headers this image deliberately does not carry.
#
# rasterio is pinned at 1.4.4 for exactly that reason: 1.4.3 ships no aarch64
# wheel, so on the Pi it tries to compile against GDAL and the build dies.
# 1.4.4 is the first release with a cp311 aarch64 wheel. Do not drop it back.
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    # base_model.py imports pyplot at module scope, so the API would try to
    # pick a GUI backend on import. Agg keeps that headless.
    MPLBACKEND=Agg \
    # The container runs unprivileged with no writable HOME; without this
    # matplotlib logs a cache warning on every single import.
    MPLCONFIGDIR=/tmp/matplotlib

# GPS_PORT and GPS_BAUDRATE have NO defaults (fail-first): sensor_state.py
# reads them with os.environ[...] and the app refuses to start without them.
# Supply them via compose (.env) — pointing GPS_PORT at the ESP32 device.

WORKDIR /app

COPY requirements.txt .
# Long timeout + persistent pip cache: geopandas/rasterio/xgboost pull tens
# of MB of wheels, and over the camp uplink --no-cache-dir would throw away
# every partial download so each retry restarted from zero.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --timeout 120 --retries 10 -r requirements.txt

# This layout is load-bearing, not cosmetic. river_shapefile.py resolves the
# shapefile as parents[3] of its own path and prediction.py resolves the model
# package as scripts/../prediction-models, so all three directories MUST stay
# siblings under the same root or the API imports fine and then 502s at the
# first river lookup. Copied resources-first: they change least often.
COPY resources/ ./resources/
COPY prediction-models/ ./prediction-models/
COPY scripts/ ./scripts/

# base_model.py runs MODELS_DIR.mkdir(exist_ok=True) at import and joblib.dump
# on the retrain fallback path (taken when models/*.pkl is missing), so the
# app tree must be owned by the runtime user rather than left root-owned.
RUN useradd --create-home --uid 10001 gateway \
    && chown -R gateway:gateway /app
USER gateway

# api.py imports `hydrospatial_api`, `gps_module`, `sensor_state` as top-level
# modules, so scripts/ — not /app — has to be the working directory.
WORKDIR /app/scripts

EXPOSE 8000

# urllib rather than curl: keeps the image free of an extra apt layer.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/', timeout=4).status == 200 else 1)"

# Exactly one worker, deliberately. The lifespan hook in api.py starts the
# background serial reader, and a second worker would open a second reader on
# the same ESP32 port — the two then steal each other's NMEA lines and both
# sensors flap between connected and disconnected.
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
