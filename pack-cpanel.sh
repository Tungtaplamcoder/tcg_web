#!/usr/bin/env bash
# =============================================================================
# pack-cpanel.sh — Build deploy-cpanel.zip with automated DB init, seed, and SQL dump
# =============================================================================
# Run from the project root (the folder that contains backend/ and frontend/):
#   bash pack-cpanel.sh [output.zip]
#
# This script:
#   1. Creates a temporary MariaDB container for building deployment artifacts
#   2. Force-applies Prisma schema migrations (prisma migrate reset --force)
#   3. Runs automated seeding (prisma db seed)
#   4. Dumps the populated database to seed.sql
#   5. Bundles everything into tcg-backend-cpanel.zip
# =============================================================================

set -euo pipefail

# ─── Color codes ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { printf '\n%s==> %s%s\n' "$BOLD$BLUE" "$*" "$NC"; }
ok()   { printf '%s    ✓ %s%s\n' "$GREEN" "$*" "$NC"; }
warn() { printf '%s    ! %s%s\n' "$YELLOW" "$*" "$NC"; }
die()  { printf '%sERROR: %s%s\n' "$BOLD$RED" "$*" "$NC" >&2; exit 1; }
info() { printf '%s    → %s%s\n' "$CYAN" "$*" "$NC"; }

# ─── Paths ───
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

OUT="${1:-tcg-backend-cpanel.zip}"
case "$OUT" in /*) ;; *) OUT="$ROOT/$OUT" ;; esac

STAGE="$(mktemp -d)"
TRAP_DIR="$STAGE"
DB_CONTAINER_NAME="tcg-pack-db-$$"
CLEANUP_DONE=false

# ─── Cleanup ───
cleanup() {
  if [ "$CLEANUP_DONE" = false ]; then
    CLEANUP_DONE=true
    [ -d "$TRAP_DIR" ] && rm -rf "$TRAP_DIR"
    if docker ps -a --format '{{.Names}}' | grep -q "^${DB_CONTAINER_NAME}$"; then
      docker stop "$DB_CONTAINER_NAME" >/dev/null 2>&1 || true
      docker rm "$DB_CONTAINER_NAME" >/dev/null 2>&1 || true
    fi
  fi
}
trap cleanup EXIT

# ─── Preflight checks ───
log "0/11 Preflight checks"
command -v zip >/dev/null 2>&1 || die "'zip' is required (apt install zip)"
command -v docker >/dev/null 2>&1 || die "'docker' is required for temporary DB"
command -v npx >/dev/null 2>&1 || die "'npx' is required (Node.js)"

[ -f "$BACKEND/package.json" ]      || die "backend/package.json not found — run from project root"
[ -f "$BACKEND/app.js" ]            || die "backend/app.js (Passenger entry) missing"
[ -f "$BACKEND/prisma/schema.prisma" ] || die "backend/prisma/schema.prisma missing"
[ -f "$BACKEND/prisma/seed.js" ]    || die "backend/prisma/seed.js missing"
[ -f "$BACKEND/.env.example" ]      || die "backend/.env.example missing"
[ -f "$ROOT/migration.sql" ]        || die "migration.sql not found in project root"
[ -f "$ROOT/DEPLOY_CPANEL.md" ]     || die "DEPLOY_CPANEL.md not found in project root"
[ -f "$OUT" ] && rm -f "$OUT"

ok "All required files present"

# ─── Step 1: Start temporary MariaDB ───
log "1/11 Starting temporary MariaDB container"
DB_ROOT_PASS="rootpass123"
DB_NAME="tcg_build_db"
DB_USER="tcg_builder"
DB_PASS="builderpass123"

docker run -d \
  --name "$DB_CONTAINER_NAME" \
  -p 13306:3306 \
  -e MARIADB_ROOT_PASSWORD="$DB_ROOT_PASS" \
  -e MARIADB_DATABASE="$DB_NAME" \
  -e MARIADB_USER="$DB_USER" \
  -e MARIADB_PASSWORD="$DB_PASS" \
  --health-cmd="mariadb-admin ping -h 127.0.0.1 -u root -p$DB_ROOT_PASS --silent" \
  --health-interval=5s \
  --health-timeout=3s \
  --health-retries=30 \
  mariadb:11.4 >/dev/null

info "Waiting for MariaDB to become healthy..."
for i in {1..30}; do
  health=$(docker inspect --format='{{.State.Health.Status}}' "$DB_CONTAINER_NAME" 2>/dev/null || echo "starting")
  [ "$health" = "healthy" ] && break
  sleep 2
done
[ "$health" = "healthy" ] || die "MariaDB failed to become healthy"
ok "MariaDB container ready ($DB_CONTAINER_NAME)"

# ─── Step 2: Configure DATABASE_URL for build ───
export DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@localhost:13306/${DB_NAME}"
export DB_HOST=localhost
export DB_PORT=13306
export DB_USER="$DB_USER"
export DB_PASS="$DB_PASS"
export DB_NAME="$DB_NAME"
export NODE_ENV=production
export SEED_FORCE=1
info "DATABASE_URL configured for build"

# ─── Step 3: Generate Prisma Client ───
log "2/11 Generating Prisma Client locally"
(cd "$BACKEND" && npx prisma generate)
[ -f "$BACKEND/src/generated/prisma/index.js" ] || die "Prisma client generation failed"
ENGINES=$(find "$BACKEND/src/generated/prisma" -name 'libquery_engine-*.so.node' 2>/dev/null | wc -l)
[ "$ENGINES" -ge 3 ] || die "Expected query engine binaries, found $ENGINES"
ok "Prisma Client generated ($ENGINES engine binaries)"

# ─── Step 4: Force-apply schema migrations ───
log "3/11 Applying Prisma migrations (prisma migrate reset --force)"
(cd "$BACKEND" && npx prisma migrate reset --force --skip-seed)
ok "Schema migrated successfully"

# ─── Step 5: Run database seeding ───
log "4/11 Seeding database (prisma db seed)"
(cd "$BACKEND" && npx prisma db seed)
ok "Database seeded successfully"

# ─── Step 6: Dump populated database to SQL ───
log "5/11 Dumping populated database to seed.sql"
DUMP_FILE="$STAGE/seed.sql"
docker exec "$DB_CONTAINER_NAME" \
  mariadb-dump \
  -u root -p"$DB_ROOT_PASS" \
  -h 127.0.0.1 \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --hex-blob \
  --complete-insert \
  --skip-add-locks \
  --skip-lock-tables \
  "$DB_NAME" > "$DUMP_FILE"

# Also create a clean version with only data (for easy import)
DUMP_DATA_ONLY="$STAGE/seed-data.sql"
docker exec "$DB_CONTAINER_NAME" \
  mariadb-dump \
  -u root -p"$DB_ROOT_PASS" \
  -h 127.0.0.1 \
  --single-transaction \
  --no-create-info \
  --complete-insert \
  --skip-add-locks \
  --skip-lock-tables \
  "$DB_NAME" > "$DUMP_DATA_ONLY" 2>/dev/null || true

# Verify dump has content
[ -s "$DUMP_FILE" ] || die "Database dump is empty"
LINES=$(wc -l < "$DUMP_FILE")
ok "Database dumped to seed.sql ($LINES lines)"

# ─── Step 7: Build frontend ───
log "6/11 Building frontend (Vite production bundle)"
if [ -d "$FRONTEND/node_modules" ]; then
  (cd "$FRONTEND" && npm run build)
else
  (cd "$FRONTEND" && npm ci --no-audit --no-fund && npm run build)
fi
[ -f "$FRONTEND/dist/index.html" ] || die "Frontend build failed (dist/index.html missing)"
ok "Frontend built successfully"

# ─── Step 8: Verify no server-side Prisma hooks ───
log "7/11 Verifying no server-side Prisma hooks in package.json"
if grep -qE '"(postinstall|preinstall|prestart|prepare)"' "$BACKEND/package.json"; then
  die "backend/package.json defines install/start lifecycle hooks — must be removed"
fi
if grep -qE '"@prisma/client"|"prisma"' <(node -e "
  const p = require('$BACKEND/package.json');
  console.log(JSON.stringify(p.dependencies || {}));
"); then
  die "backend/package.json lists prisma/@prisma/client in production dependencies"
fi
ok "No server-side Prisma hooks or runtime deps"

# ─── Step 9: Stage backend production files ───
log "8/11 Staging backend production files"
mkdir -p "$STAGE/backend/prisma" "$STAGE/backend/public"

# Backend: runtime code only
(cd "$BACKEND" && tar -cf - \
  app.js \
  package.json \
  package-lock.json \
  src \
  prisma/schema.prisma \
  prisma/migrations \
  prisma/seed.js \
  public/uploads \
  2>/dev/null) | (cd "$STAGE/backend" && tar -xf -)

# Ensure uploads dir exists
mkdir -p "$STAGE/backend/public/uploads"

# Stage pre-built SPA
info "Staging pre-built SPA into backend/public/"
cp -R "$FRONTEND/dist/." "$STAGE/backend/public/"
[ -f "$STAGE/backend/public/index.html" ] || die "Frontend build was not staged"

# Verify generated client staged
[ -f "$STAGE/backend/src/generated/prisma/index.js" ] || die "Generated client not staged"
ok "Backend files staged"

# ─── Step 10: Write server configs & copy SQL dump ───
log "9/11 Writing server configs & copying SQL dump"

# .npmrc guard
cat > "$STAGE/backend/.npmrc" <<'NPMRC'
# Server-side guard: the generated Prisma client ships pre-built in
# src/generated/prisma; no package lifecycle script (esp. any prisma
# postinstall / engine download / Wasm schema validation) may run here.
ignore-scripts=true
NPMRC

# Copy migration.sql (schema-only reference) - seed.sql is already in STAGE from dump
cp "$ROOT/migration.sql" "$STAGE/migration.sql"
cp "$ROOT/DEPLOY_CPANEL.md" "$STAGE/DEPLOY_CPANEL.md"

# .env.production template
cat > "$STAGE/.env.production" <<'ENVTPL'
# ==============================================================================
# TCG E-Commerce — production environment template
# ==============================================================================
# Copy these key-values into TWO places:
#   1. Setup Node.js App > Environment variables (GUI form) — REQUIRED
#   2. Optionally also into backend/.env via File Manager (dotenv fallback)
# Replace every placeholder before going live. NEVER commit real secrets.
# ==============================================================================

NODE_ENV=production

# --- Database (from cPanel > MySQL Databases) ---
DB_HOST=localhost
DB_PORT=3306
DB_USER=cpaneluser_tcg
DB_PASS=your_db_password
DB_NAME=cpaneluser_tcgdb
DATABASE_URL=mysql://cpaneluser_tcg:your_db_password@localhost:3306/cpaneluser_tcgdb
DB_POOL_LIMIT=5
DB_POOL_TIMEOUT=10
DATABASE_SSL_MODE=disable

# --- Auth secrets (generate two DIFFERENT random base64 strings) ---
JWT_ACCESS_SECRET=<random-base64-string-1>
JWT_REFRESH_SECRET=<random-base64-string-2>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# --- Public URLs (your real domain — NO trailing slash, https only) ---
NEXT_PUBLIC_APP_URL=https://yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com

# --- SePay payment gateway ---
SEPAY_API_URL=https://my.sepay.vn
SEPAY_ENV=production
SEPAY_MERCHANT_ID=...
SEPAY_MERCHANT_SECRET_KEY=...
SEPAY_WEBHOOK_SECRET=...

# --- SMTP (order/notification emails) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

# --- First admin account ---
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=...

# --- Image uploads ---
IMGBB_API_KEY=...
ENVTPL

ok "Configs written, seed.sql copied"

# ─── Step 11: Write .htaccess and zip ───
log "10/11 Writing Apache .htaccess"
cat > "$STAGE/.htaccess" <<'HTACCESS'
# cPanel / Apache + Phusion Passenger — TCG E-Commerce
# The Node app (Passenger entry: app.js) serves the SPA from public/ and the
# API under /api/v1. This file only passes requests through and never exposes
# .env.

PassengerEnabled On
PassengerAppType node
PassengerStartupFile app.js

# Do NOT serve dotfiles (.env, .git) — always deny.
<FilesMatch "^\.(?!well-known)">
  Require all denied
</FilesMatch>

# Never serve the environment file.
<Files ".env">
  Require all denied
</Files>

# Compress text assets served by Apache (API responses are gzipped by Express).
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/css application/javascript application/json image/svg+xml
</IfModule>

# Sensible caching for the hashed SPA bundle.
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 month"
</IfModule>
HTACCESS

log "11/11 Creating final archive: $(basename "$OUT")"
(cd "$STAGE" && zip -qr9 "$OUT" .htaccess .env.production DEPLOY_CPANEL.md migration.sql seed.sql backend)

echo ""
echo -e "${BOLD}${GREEN}✓ Pack complete: $OUT${NC}"
unzip -l "$OUT" | tail -5
echo ""
echo "Archive contents:"
echo "  backend/              → API + PRE-BUILT src/generated/prisma + prisma/ + pre-built public/ SPA"
echo "  migration.sql         → Schema-only reference (original)"
echo "  seed.sql              → FULL schema + seeded data (NEW - for phpMyAdmin import)"
echo "  seed-data.sql         → Data-only insert statements (optional)"
echo "  DEPLOY_CPANEL.md      → GUI-only manual setup guide"
echo "  .env.production       → Template of required environment variables"
echo "  .htaccess             → Apache config (routes /api & /socket.io through Passenger)"
echo ""
echo -e "${BOLD}Server-side execution is pure runtime: no prisma generate, no build steps.${NC}"
echo -e "${CYAN}Import seed.sql via phpMyAdmin to get a fully populated database.${NC}"