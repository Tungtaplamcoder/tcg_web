# =============================================================================
# Production-ready Dockerfile for TCG E-Commerce Frontend (Vite + React)
# =============================================================================
# Multi-stage build: build -> nginx serve
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build the Vite React application
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files explicitly to ensure package-lock.json is included
COPY package.json package-lock.json ./

# Install all dependencies with fallback for peer dependency issues
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build arguments for environment variables
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_APP_URL
ARG VITE_ENABLE_CHAT
ARG VITE_ENABLE_PAYMENT
ARG VITE_ENABLE_WISHLIST

# Set environment variables for build
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}
ENV VITE_APP_URL=${VITE_APP_URL}
ENV VITE_ENABLE_CHAT=${VITE_ENABLE_CHAT}
ENV VITE_ENABLE_PAYMENT=${VITE_ENABLE_PAYMENT}
ENV VITE_ENABLE_WISHLIST=${VITE_ENABLE_WISHLIST}

# Build the application
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Serve with Nginx
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration (now includes http block)
COPY nginx.conf /etc/nginx/nginx.conf

# Create temp directories in /tmp for non-root nginx user
RUN mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp && \
    chown -R nginx:nginx /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp /usr/share/nginx/html

# Switch to non-root user (nginx user exists in base image)
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]