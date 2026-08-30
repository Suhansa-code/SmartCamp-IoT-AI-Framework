# Edge Gateway — FastAPI service for GPS/DHT11/rainfall sensors, hydrospatial
# lookups and the XGBoost flood model. Built and run on the Raspberry Pi
# (linux/arm64); build from THIS directory so resources/ and prediction-models/
# are in context:
#
#   docker build -t smartcamp-edge-gateway .
#
# Pinned to 3.11 for the same reason as the other Pi images: numpy, scipy,
# scikit-learn, shapely, pyogrio and xgboost all publish arm64 wheels for cp311,
# and a newer minor silently falls back to a source build that will not finish
# on a Pi.
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    # Headless: base_model imports pyplot at module scope, so without a
    # non-interactive backend importing the prediction provider fails outright.
    MPLBACKEND=Agg \
    MPLCONFIGDIR=/tmp/matplotlib

# libgomp1 is the OpenMP runtime that the xgboost and scikit-learn arm64 wheels
# link against. It is NOT in the slim base, and without it importing xgboost
# dies with "libgomp.so.1: cannot open shared object file" — which surfaces as
# a permanently unavailable /hydrospatial prediction, not a boot failure.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY scripts/requirements.txt .
# Long timeout + a persistent pip cache: built on the Pi over the camp uplink,
# where the geopandas/pyproj/scipy wheels will not arrive inside pip's 15s
# default. The cache mount is what makes a retry cheap — --no-cache-dir throws
# away every partial download and restarts each attempt from zero.
#
# The second install covers the flood model. These are deliberately not in
# scripts/requirements.txt, which only lists what the API layer imports; the
# prediction provider pulls them in lazily at first /hydrospatial call.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --timeout 120 --retries 10 -r requirements.txt \
 && pip install --timeout 120 --retries 10 \
        xgboost scikit-learn joblib matplotlib

# Copied before scripts/ so that editing the API does not invalidate the model
# warm-up layer below. river_shapefile.py resolves resources/ as a sibling of
# scripts/ (parents[3]), so this layout is load-bearing — do not flatten it.
COPY resources/ ./resources/
COPY prediction-models/ ./prediction-models/

# No model artifact is committed, so load_model() trains on the 25k-row dataset
# the first time a prediction is requested — a multi-minute stall on a Pi, paid
# by whichever request arrives first, and paid again after every restart since
# the .pkl lives in the container. Training here bakes it into the image.
# Non-fatal on purpose: the runtime path already falls back to lazy training,
# so a warm-up failure costs latency, not a broken image.
RUN python prediction-models/xgboost_model/xgboost_model.py || \
    echo "WARN: model warm-up failed; the first prediction will train instead"

COPY scripts/ ./scripts/

# The code defaults to COM5 (a Windows dev box). Override to match how the
# ESP32 enumerates on the Pi — ttyUSB0, ttyACM1, ... See docker run below.
ENV GPS_PORT=/dev/ttyUSB0 \
    GPS_BAUDRATE=115200

# api.py imports its siblings as top-level modules (hydrospatial_api, gps_module,
# ...), so uvicorn must be started from inside scripts/.
WORKDIR /app/scripts

EXPOSE 8000

# curl is not in the slim base and is not worth a layer just for this.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/', timeout=5)" || exit 1

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
