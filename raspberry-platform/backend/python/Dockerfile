# Flask side-service for the resource/anomaly models.
# Pinned to 3.11: numpy and scikit-learn publish arm64 wheels for cp311, and a
# newer minor can fall back to a source build that will not finish on a Pi.
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1
WORKDIR /app

# Build context is backend/, so these paths are backend-relative.
COPY python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY python/ .

EXPOSE 5001
CMD ["python", "app.py"]
