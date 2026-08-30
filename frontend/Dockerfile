# =============================================================================
# Production-ready multi-stage Dockerfile for TCG E-Commerce Frontend
# (Vite + React built at build time, served by Nginx at runtime)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build the Vite React application
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

COPY . .

# Build arguments injected as VITE_ env vars (baked into the bundle)
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_APP_URL
ARG VITE_PORT
ARG VITE_ENABLE_CHAT
ARG VITE_ENABLE_PAYMENT
ARG VITE_ENABLE_WISHLIST

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}
ENV VITE_APP_URL=${VITE_APP_URL}
ENV VITE_PORT=${VITE_PORT}
ENV VITE_ENABLE_CHAT=${VITE_ENABLE_CHAT}
ENV VITE_ENABLE_PAYMENT=${VITE_ENABLE_PAYMENT}
ENV VITE_ENABLE_WISHLIST=${VITE_ENABLE_WISHLIST}

RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Serve the built assets with Nginx (non-root user)
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA-aware Nginx config from the frontend folder
COPY nginx.conf /etc/nginx/nginx.conf

# Non-root nginx needs writable temp dirs
RUN mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp && \
    chown -R nginx:nginx /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp /usr/share/nginx/html

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
