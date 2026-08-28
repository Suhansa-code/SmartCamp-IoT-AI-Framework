# Cloud frontend — Next 16 (App Router) served from its standalone output.
#
# Build this on a workstation, not on the t3.micro: `next build` fans out one
# worker per CPU and will be OOM-killed on a 1 GB box. Both are x86-64, so the
# image moves across unchanged.
#
#   docker compose build --build-arg NEXT_PUBLIC_API_URL=http://<IP>:3001 frontend

FROM node:22-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_* is inlined into the client bundle at build time, not read at
# runtime — so this is a build arg, and changing the API URL means rebuilding.
# Left unset, every fetch falls back to http://localhost:3002, which resolves
# to the visitor's own machine and fails silently in their browser.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# The disaster pages read a *separate* var that was never unified with the one
# above, though both hit /api/* on the same backend. Left unset it defaults to
# localhost:3002 and only the disaster domain comes up empty — everything else
# looks fine, which makes it a nasty thing to debug. Default it to the main URL.
ARG NEXT_PUBLIC_DISASTER_API_BASE_URL
ENV NEXT_PUBLIC_DISASTER_API_BASE_URL=${NEXT_PUBLIC_DISASTER_API_BASE_URL:-$NEXT_PUBLIC_API_URL}

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

# Standalone binds loopback unless HOSTNAME says otherwise, which inside a
# container means nothing outside it can connect.
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# next.config.mjs sets output:'standalone', which bundles a trimmed
# node_modules but deliberately leaves out static assets — both COPY lines
# below are load-bearing, or the app renders unstyled with no images.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
