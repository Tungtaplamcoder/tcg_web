#!/usr/bin/env bash
# =============================================================================
# TCG E-Commerce — Fully automated production deployment script
# =============================================================================
set -euo pipefail

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE="docker compose"
BACKEND_PORT="${BACKEND_PORT:-4000}"
STACK_WAIT_RETRIES=30
STACK_WAIT_SLEEP=3

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[0;32m    ✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[0;33m    ! %s\033[0m\n' "$*"; }
die()  { printf '\033[0;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# -----------------------------------------------------------------------------
# 1. Preflight
# -----------------------------------------------------------------------------
log "1/9 Preflight checks"
command -v docker >/dev/null 2>&1 || die "docker is not installed"
$COMPOSE version >/dev/null 2>&1 || die "docker compose plugin is not installed"
[ -f .env ] || die ".env not found in $SCRIPT_DIR — copy .env.example and fill it in"
[ -f docker-compose.yml ] || die "docker-compose.yml not found in $SCRIPT_DIR"

grep -q '^DB_PASS=.\+' .env || die "DB_PASS is empty in .env"
grep -q '^DATABASE_URL=.\+' .env || die "DATABASE_URL is empty in .env"
ok "docker $(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1), env OK"

# -----------------------------------------------------------------------------
# 2. Pull latest code
# -----------------------------------------------------------------------------
log "2/9 Pulling latest code"
if [ -d .git ] && command -v git >/dev/null 2>&1; then
    if git pull --ff-only >/dev/null 2>&1; then
        ok "git pull fast-forward OK"
    else
        warn "git pull skipped (diverged branches / no upstream) — deploying current working tree"
    fi
else
    warn "not a git checkout — deploying current files"
fi

# -----------------------------------------------------------------------------
# 3. Graceful teardown (volumes preserved & clean stale networks)
# -----------------------------------------------------------------------------
log "3/9 Stopping existing stack (graceful, data preserved)"
$COMPOSE down --remove-orphans --timeout 30 || warn "compose down reported an issue (continuing)"
docker network prune -f >/dev/null 2>&1 || true

# -----------------------------------------------------------------------------
# 4. Build images
# -----------------------------------------------------------------------------
log "4/9 Building images"
if [ "${1:-}" = "--no-cache" ]; then
    warn "--no-cache: full clean rebuild requested"
    $COMPOSE build --no-cache
else
    $COMPOSE build
fi
ok "images built"

# -----------------------------------------------------------------------------
# 5. Start MariaDB and wait until genuinely healthy
# -----------------------------------------------------------------------------
log "5/9 Starting MariaDB and waiting for health"
$COMPOSE up -d mariadb

db_ready=false
for i in $(seq 1 "$STACK_WAIT_RETRIES"); do
    health="$($COMPOSE ps --format json mariadb | python3 -c 'import sys,json; print(json.load(sys.stdin)["Health"])' 2>/dev/null || true)"
    net_ok="$($COMPOSE exec -T mariadb sh -c 'command -v mariadb-admin >/dev/null && mariadb-admin ping -h 127.0.0.1 -u root -p"$MARIADB_ROOT_PASSWORD" --silent' >/dev/null 2>&1 && echo yes || echo no)"
    if [ "$health" = "healthy" ] && [ "$net_ok" = "yes" ]; then
        ok "MariaDB healthy (network + InnoDB ready) after ${i} probe(s)"
        db_ready=true
        break
    fi
    echo "    waiting... (attempt $i/$STACK_WAIT_RETRIES, health=${health:-unknown})"
    sleep "$STACK_WAIT_SLEEP"
done

if [ "$db_ready" = false ]; then
    warn "MariaDB not healthy in time — dumping last logs:"
    $COMPOSE logs --tail 30 mariadb || true
    die "aborting BEFORE any migration or seed"
fi

# -----------------------------------------------------------------------------
# 6. Run Prisma migrations (using backend container directly)
# -----------------------------------------------------------------------------
log "6/9 Applying database migrations (prisma migrate deploy)"
# Khởi chạy Backend container trước để tận dụng Network đã khởi tạo ổn định
$COMPOSE up -d backend
# db-url-exec composes DATABASE_URL from DB_* parts (URL-encoded, immune to
# special chars in DB_PASS and stale .env strings) before running Prisma.
# Pin prisma@5.22.0: the runtime image ships no CLI (prod deps only), so bare
# `npx prisma` would fetch the latest (v7), which rejects the v5 schema.
$COMPOSE exec -T backend node scripts/db-url-exec.js -- npx --yes prisma@5.22.0 migrate deploy
ok "schema is up to date"

# -----------------------------------------------------------------------------
# 7. Seed (idempotent — skips when data exists)
# -----------------------------------------------------------------------------
log "7/9 Seeding database (skips automatically if data exists)"
if $COMPOSE exec -T backend node scripts/db-url-exec.js -- node prisma/seed.js; then
    ok "seed completed"
else
    warn "seed exited non-zero (often just an already-seeded DB) — continuing"
fi

# -----------------------------------------------------------------------------
# 8. Start the full application stack
# -----------------------------------------------------------------------------
log "8/9 Starting backend + frontend + nginx"
$COMPOSE up -d
ok "stack started"

# -----------------------------------------------------------------------------
# 9. Verify deployment with real HTTP health checks
# -----------------------------------------------------------------------------
log "9/9 Verifying deployment health"

app_ok=false
for i in $(seq 1 "$STACK_WAIT_RETRIES"); do
    if curl -fsS --max-time 5 "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
        ok "backend health: http://localhost:${BACKEND_PORT}/health → 200 OK"
        app_ok=true
        break
    fi
    echo "    waiting for backend... (attempt $i/$STACK_WAIT_RETRIES)"
    sleep "$STACK_WAIT_SLEEP"
done
[ "$app_ok" = true ] || die "backend did not become healthy at http://localhost:${BACKEND_PORT}/health"

curl -fsS --max-time 5 "http://localhost:${FRONTEND_PORT:-3000}/" >/dev/null 2>&1 \
    && ok "frontend: http://localhost:${FRONTEND_PORT:-3000} → 200 OK" \
    || warn "frontend not answering yet on :${FRONTEND_PORT:-3000} (may still be starting)"

curl -fsS --max-time 5 "http://localhost/health" >/dev/null 2>&1 \
    && ok "nginx entrypoint: http://localhost/health → 200 OK" \
    || warn "nginx :80 not answering yet (check tcg_nginx logs)"

echo
$COMPOSE ps
echo
printf '\033[1;32m==> DEPLOYMENT COMPLETE\033[0m\n'
echo "    App:         http://localhost"
echo "    Frontend:    http://localhost:${FRONTEND_PORT:-3000}"
echo "    Backend API: http://localhost:${BACKEND_PORT}/api/v1"
echo "    Health:      http://localhost:${BACKEND_PORT}/health"