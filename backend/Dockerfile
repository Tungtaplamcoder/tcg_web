# =============================================================================
# Production-ready multi-stage Dockerfile for TCG E-Commerce Backend
# =============================================================================
# Base image: Debian slim (glibc) — the Prisma schema declares
# `debian-openssl-1.1.x` / `debian-openssl-3.0.x` binary targets, so the
# runtime must be a glibc distro. Alpine (musl) would need a different
# engine target (linux-musl-openssl-3.0.x) and is intentionally avoided.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Shared base — system deps + non-root user
# -----------------------------------------------------------------------------
FROM node:20-slim AS base

# dumb-init: proper PID 1 signal forwarding (SIGTERM -> graceful shutdown)
#   Prisma query engine needs openssl on the runtime
#   mariadb-client: mariadb/mariadb-dump for backup + DB health probing
RUN apt-get update && apt-get install -y --no-install-recommends \
        dumb-init \
        openssl \
        mariadb-client \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /usr/sbin/nologin --create-home nodejs

# -----------------------------------------------------------------------------
# Stage 2: deps — install ALL dependencies (incl. dev: prisma CLI) + generate
# -----------------------------------------------------------------------------
# Prisma generate happens HERE, inside the Linux container, so the query
# engine binaries always match the container's native platform
# (debian-openssl-3.0.x on node:20-slim / Debian 12). No host-built
# node_modules is ever copied into the image — eliminates the classic
# host/container binaryTarget mismatch.
# Note: devDeps (prisma CLI) are needed HERE for generate, but the runner
# stage below installs prod-only deps and copies the generated client in.
FROM base AS deps

COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Full install (dev incl. prisma CLI) — needed for `prisma generate` below.
# `prisma generate` writes to src/generated/prisma (custom output in schema).
# --include=dev is REQUIRED: base stage sets NODE_ENV=production, which makes
# plain `npm ci` skip devDependencies (prisma CLI) — npx would then fetch the
# latest prisma (v7), whose schema format is incompatible with this v5 schema.
RUN npm ci --include=dev --legacy-peer-deps

# Generate Prisma Client against the container's platform (schema + migrations
# are present, so the client and migration history stay in sync).
RUN npx prisma generate

# Prod-only node_modules for the runtime image (prisma CLI excluded).
RUN npm ci --omit=dev --legacy-peer-deps

# -----------------------------------------------------------------------------
# Stage 3: runner — final production image
# -----------------------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production

# Install: prod node_modules (NO prisma CLI, NO @prisma/client — the runtime
# uses the standalone generated client copied from src/ below)
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# App code (src/ first; src/generated is then OVERWRITTEN below with the
# container-generated client so engine binaries always match this image)
COPY --chown=nodejs:nodejs package.json package-lock.json ./
COPY --chown=nodejs:nodejs prisma ./prisma/
COPY --chown=nodejs:nodejs src ./src/
COPY --from=deps --chown=nodejs:nodejs /app/src/generated ./src/generated
COPY --chown=nodejs:nodejs scripts ./scripts/

# Runtime-writable dirs (uploads + logs); volumes mount over these.
RUN mkdir -p /app/public/uploads /app/uploads /app/logs && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4000

# Container-level healthcheck — hits the /health route served by Express.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=5 \
    CMD node -e "require('http').get('http://127.0.0.1:4000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
