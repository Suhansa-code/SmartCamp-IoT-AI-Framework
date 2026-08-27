# Network state monitor — measures the uplink, forecasts it, pushes to the Pi
# backend. Runs with network_mode: host so it measures the real link rather
# than the docker bridge's NAT path (see docker-compose.yml).
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1

# ping is the RTT/loss source; without it every sample reports 100% loss.
RUN apt-get update && apt-get install -y --no-install-recommends \
        iputils-ping \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY scripts/ ./scripts/
# Committed artifacts — a fresh clone must not need to retrain to boot.
COPY models/ ./models/

CMD ["python", "-u", "scripts/network_monitor_service.py"]
