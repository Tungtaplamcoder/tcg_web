# =============================================================================
# Production-ready multi-stage Dockerfile for TCG E-Commerce Backend
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base image with system dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# postgresql-client provides pg_isready (used by compose healthcheck wrapper)
# openssl is required by the Prisma engine on Alpine (OpenSSL 3.x)
RUN apk update && apk add --no-cache \
    postgresql-client \
    dumb-init \
    openssl

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# -----------------------------------------------------------------------------
# Stage 2: Production dependencies + Prisma client generation
# -----------------------------------------------------------------------------
FROM base AS deps

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci --only=production --ignore-scripts --legacy-peer-deps || \
    npm install --only=production --ignore-scripts --legacy-peer-deps

RUN npx prisma generate

# -----------------------------------------------------------------------------
# Stage 3: Build stage (full deps + source, mirror of deps for the app code)
# -----------------------------------------------------------------------------
FROM base AS builder

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci --ignore-scripts --legacy-peer-deps || \
    npm install --ignore-scripts --legacy-peer-deps

RUN npx prisma generate

COPY src ./src

# -----------------------------------------------------------------------------
# Stage 4: Production image
# -----------------------------------------------------------------------------
FROM base AS production

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY --from=deps /app/prisma ./prisma

COPY --from=builder /app/src ./src

RUN mkdir -p /app/uploads /app/logs /app/public/uploads && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (r) => { if (r.statusCode !== 200) process.exit(1) })" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
