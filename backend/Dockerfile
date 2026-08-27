# =============================================================================
# Production-ready Dockerfile for TCG E-Commerce Backend
# =============================================================================
# Multi-stage build for smaller production image
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base image with dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Install system dependencies - update apk index first to avoid stale repository errors
RUN apk update && apk add --no-cache \
    postgresql-client \
    dumb-init

# Create app directory and user
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# -----------------------------------------------------------------------------
# Stage 2: Install production dependencies
# -----------------------------------------------------------------------------
FROM base AS deps

# Copy package files explicitly to ensure package-lock.json is included
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install production dependencies only with fallback for peer dependency issues
RUN npm ci --only=production --ignore-scripts --legacy-peer-deps || npm install --only=production --ignore-scripts --legacy-peer-deps && \
    npm cache clean --force

# Generate Prisma Client
RUN npx prisma generate

# -----------------------------------------------------------------------------
# Stage 3: Build stage (for TypeScript compilation if needed)
# -----------------------------------------------------------------------------
FROM base AS builder

# Copy package files explicitly to ensure package-lock.json is included
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev) with fallback for peer dependency issues
RUN npm ci --ignore-scripts --legacy-peer-deps || npm install --ignore-scripts --legacy-peer-deps

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY src ./src

# Build if needed (for TypeScript projects)
# RUN npm run build

# -----------------------------------------------------------------------------
# Stage 4: Production image
# -----------------------------------------------------------------------------
FROM base AS production

# Set environment
ENV NODE_ENV=production

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY --from=deps /app/prisma ./prisma

# Copy built application
COPY --from=builder /app/src ./src

# Create directories for uploads/logs
RUN mkdir -p /app/uploads /app/logs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (r) => { if (r.statusCode !== 200) process.exit(1) })" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "src/server.js"]