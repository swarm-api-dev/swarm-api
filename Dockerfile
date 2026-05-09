# SwarmApi gateway image. Builds the workspace and runs the gateway via tsx.
# Suitable for Railway / Fly.io / Render / any Docker-compatible host.

FROM node:22-alpine

# better-sqlite3 needs native build tools on Alpine; wget powers the healthcheck.
RUN apk add --no-cache python3 make g++ wget

WORKDIR /app

# Copy the entire monorepo. .dockerignore drops node_modules, secrets, and
# everything else that doesn't belong in the image.
COPY . .

# Installs all workspace deps. Triggers the root `prepare` hook which builds
# @swarmapi/sdk so the gateway's transitive imports resolve cleanly.
# better-sqlite3 builds its native binding here.
RUN npm install --no-audit --no-fund

ENV NODE_ENV=production
ENV PORT=3000
ENV NETWORK_PROFILE=base-mainnet
ENV DB_PATH=/data/swarmapi.sqlite

# Persist payments + endpoints + cache rows across container restarts.
VOLUME ["/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O - http://localhost:3000/health || exit 1

# Required env at runtime (set via the host platform, not in the image):
#   PAY_TO_ADDRESS  — your receiving wallet on Base mainnet (REQUIRED)
#   BRAVE_API_KEY   — for /v1/web/search (optional; endpoint 502s without it)
#   GITHUB_TOKEN    — for /v1/github/repo (optional; falls back to 60 req/hr)
#   FACILITATOR_URL — override per-profile default (optional)

CMD ["npx", "tsx", "packages/gateway/src/index.ts"]
