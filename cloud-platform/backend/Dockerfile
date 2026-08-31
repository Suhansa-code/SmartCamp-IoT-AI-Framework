# Cloud backend — Express API over Postgres + EMQX (ESM, Node 22).
#
# Build context is cloud-platform/, NOT backend/. config/env.js resolves the
# resource-model artifacts to ../../../prediction-models/models/lka_v2, which
# sits outside the backend package; a backend-rooted context builds an image
# that starts cleanly and then throws on the first /api/resources call.
#
#   docker compose build backend

FROM node:22-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app

# RealNetworkMonitor shells out to `ping -c 5`. Its catch block swallows a
# missing binary and returns the 999ms / 100%-loss fallback, so without iputils
# the network domain reports a dead uplink forever instead of erroring.
# (Alpine 3.24 split iputils; the ping binary is in iputils-ping.)
RUN apk add --no-cache iputils-ping

ENV NODE_ENV=production \
    PORT=3001

COPY --from=deps /app/node_modules ./node_modules
COPY backend/package.json ./package.json
COPY backend/src ./src
# EMQX TLS root. Read in a try/catch by campData/syncReceiver, so a missing
# file silently downgrades to unverified TLS rather than failing loudly.
COPY backend/emqxsl-ca.crt ./emqxsl-ca.crt

# Resource-model artifacts. Every path env.js resolves with the ../../../ walk
# must be pinned here: that walk is correct from backend/src/config in the repo
# but lands at / in-image, where src sits directly under WORKDIR. Adding an
# artifact to env.js without a line here 500s the endpoint that reads it.
COPY prediction-models/models ./prediction-models/models
ENV RATION_RATES_PATH=/app/prediction-models/models/lka_v2/ration_rates.json \
    FOOD_RATES_RAW_PATH=/app/prediction-models/models/lka_v2/food_rates_raw.json \
    COMMODITY_SHARES_PATH=/app/prediction-models/models/lka_v2/commodity_shares.json \
    COMMODITY_ALIASES_PATH=/app/prediction-models/models/lka_v2/commodity_aliases.json

# ALERTS_DB_PATH defaults to /app/data/alerts.db — a named volume in compose,
# since *.db is gitignored and the SQLite file must outlive the container.
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 3001
CMD ["node", "src/server.js"]
