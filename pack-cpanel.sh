#!/usr/bin/env bash
# =============================================================================
# pack-cpanel.sh — Build deploy-cpanel.zip with automated DB init, seed, and SQL dump
# =============================================================================
# Run from the project root (the folder that contains backend/ and frontend/):
#   bash pack-cpanel.sh [options] [output.zip]
#
# Options:
#   --dry-run      Validate preflight + print the cPanel provisioning plan only.
#                  No docker build, no database, no remote changes. (Safe CI check)
#   --provision    After packing, provision the cPanel database + user + grants
#                  via the cPanel UAPI and auto-import database/dump.sql,
#                  then write backend/.env. Requires .env.cpanel.deploy.
#                  (Also enabled by CPANEL_AUTO_PROVISION=1)
#   --no-provision Force-skip provisioning even if CPANEL_AUTO_PROVISION=1.
#   -h, --help     Show this help.
#
# This script:
#   1. Creates a temporary MariaDB container for building deployment artifacts
#   2. Force-applies Prisma schema migrations (prisma migrate reset --force)
#   3. Runs automated seeding (prisma db seed — SEED_FORCE=1 clean master data)
#   4. VERIFIES the seeded Pokémon TCG master data (no legacy rows, no orphans,
#      no PK-collision-prone state) before anything is packaged
#   5. Dumps the populated database to seed.sql (and database/dump.sql)
#   6. Ensures Prisma client generation deps and runs `npx prisma generate`
#      so the Linux query-engine binaries are bundled
#   7. Installs PRODUCTION node_modules (express, helmet, jsonwebtoken, …)
#      into the staging dir via `npm ci --omit=dev` so the archive ships them
#      at backend/node_modules/ (fixes "Cannot find module 'express'" on
#      cPanel Node.js Selector / Passenger without any server-side install)
#   8. Bundles everything into tcg-backend-cpanel.zip and verifies the
#      archive contains app.js, package.json, prisma/, and node_modules/
#   9. [--provision] Automates 100% of cPanel DB provisioning via UAPI
#      (create_database → create_user → set_privileges_on_database), imports
#      the SQL dump, and writes backend/.env — zero GUI actions required.
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

# ─── Flags / config ───
DRY_RUN=false          # --dry-run: preflight + print provisioning plan, no build
PROVISION=false        # --provision / CPANEL_AUTO_PROVISION=1: run cPanel UAPI DB setup
OUT="tcg-backend-cpanel.zip"
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)        DRY_RUN=true ;;
    --provision)      PROVISION=true ;;
    --no-provision)   PROVISION=false ;;
    -h|--help)        sed -n '2,35p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)               die "Unknown option: $1" ;;
    *)                OUT="$1" ;;
  esac
  shift
done
[ "${CPANEL_AUTO_PROVISION:-0}" = "1" ] && PROVISION=true
[ "$DRY_RUN" = true ] && [ "$PROVISION" = false ] && PROVISION=true

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

# ─── SQL input auto-generation (migration.sql / database/dump.sql fallback) ───
# Reads KEY=value from a .env file without sourcing it (values are untrusted).
env_get() {
  local key="$1" file="$2"
  [ -f "$file" ] || return 1
  grep -E "^${key}=" "$file" 2>/dev/null | tail -n1 | cut -d= -f2- || true
}

# Dump a live MySQL/MariaDB (docker container first, then direct TCP) into
# database/dump.sql. Returns non-zero if no reachable populated DB is found.
gen_sql_from_live_db() {
  local out="$ROOT/database/dump.sql"
  local env_file="$ROOT/.env"
  local db_user db_pass db_name db_host db_port
  db_user="$(env_get DB_USER "$env_file" || true)"
  db_pass="$(env_get DB_PASS "$env_file" || true)"
  db_name="$(env_get DB_NAME "$env_file" || true)"
  db_host="$(env_get DB_HOST "$env_file" || true)"
  db_port="$(env_get DB_PORT "$env_file" || true)"
  db_host="${db_host:-127.0.0.1}"
  db_port="${db_port:-3306}"

  # (a) Docker DB container (tcg_db / tcg_mariadb / any *maria*|*mysql*)
  if command -v docker >/dev/null 2>&1; then
    local names=()
    [ -n "${TCG_DB_CONTAINER:-}" ] && names+=("$TCG_DB_CONTAINER")
    names+=(tcg_db tcg_mariadb)
    while IFS= read -r n; do [ -n "$n" ] && names+=("$n"); done \
      < <(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE 'maria|mysql' || true)

    local c
    for c in "${names[@]}"; do
      [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" = "true" ] || continue
      local target="$db_name"
      if [ -z "$target" ]; then
        target="$(docker exec "$c" sh -c 'mariadb -N -B -e "SHOW DATABASES"' 2>/dev/null \
          | grep -vE '^(information_schema|performance_schema|mysql|sys)$' | head -n1 || true)"
      fi
      [ -n "$target" ] || continue
      local dumper
      dumper="$(docker exec "$c" sh -c 'command -v mariadb-dump || command -v mysqldump' 2>/dev/null | head -n1 || true)"
      [ -n "$dumper" ] || dumper="mariadb-dump"

      info "Live DB detected in container '$c' (db: $target) — exporting..."
      if docker exec -e MYSQL_PWD="$db_pass" "$c" "$dumper" --single-transaction --routines --triggers \
           -u"$db_user" "$target" > "$out" 2>/dev/null && grep -q 'CREATE TABLE' "$out"; then
        ok "Exported schema+data from container '$c'"
        return 0
      fi
      # Root fallback (dev containers sometimes use a different app user)
      if docker exec "$c" "$dumper" --single-transaction -uroot "$target" > "$out" 2>/dev/null \
           && grep -q 'CREATE TABLE' "$out"; then
        ok "Exported schema+data from container '$c' (root)"
        return 0
      fi
    done
  fi

  # (b) Direct TCP connection (non-docker local/remote DB)
  if command -v mysqldump >/dev/null 2>&1 && [ -n "$db_name" ]; then
    info "Probing MySQL at ${db_host}:${db_port} (db: $db_name)..."
    if MYSQL_PWD="$db_pass" mysqldump --host="$db_host" --port="$db_port" --user="$db_user" \
         --single-transaction --routines --triggers "$db_name" > "$out" 2>/dev/null \
         && grep -q 'CREATE TABLE' "$out"; then
      ok "Exported schema+data from ${db_host}:${db_port}"
      return 0
    fi
  fi

  rm -f "$out"
  return 1
}

# Deterministic schema-only baseline: concatenate Prisma migration files.
# Used when no live DB is reachable so preflight (and the deploy zip) always
# have a valid SQL artifact. A real pack replaces it in step 6 with the seeded dump.
gen_sql_baseline() {
  local out="$ROOT/database/dump.sql"
  local migrations_dir="$BACKEND/prisma/migrations"
  [ -d "$migrations_dir" ] || return 1

  local files=()
  while IFS= read -r f; do [ -n "$f" ] && files+=("$f"); done \
    < <(ls -1 "$migrations_dir"/*/migration.sql 2>/dev/null | LC_ALL=C sort || true)
  [ "${#files[@]}" -gt 0 ] || return 1

  {
    printf -- '-- Auto-generated schema baseline by pack-cpanel.sh\n'
    printf -- '-- Source: backend/prisma/migrations/*/migration.sql (no live DB was reachable)\n\n'
    local f
    for f in "${files[@]}"; do
      printf -- '-- >>> %s\n' "${f#"$ROOT"/}"
      cat "$f"
      printf '\n'
    done
  } > "$out"

  grep -q 'CREATE TABLE' "$out" || { rm -f "$out"; return 1; }
  return 0
}

# Ensure a usable SQL input exists; export SQL_INPUT. Never fails in dry-run.
ensure_sql_input() {
  mkdir -p "$ROOT/database"

  local candidate
  for candidate in "$ROOT/migration.sql" "$ROOT/database/dump.sql"; do
    if [ -f "$candidate" ]; then
      SQL_INPUT="$candidate"
      return 0
    fi
  done

  warn "migration.sql / database/dump.sql not found — attempting auto-generation..."

  if [ "$DRY_RUN" = true ]; then
    # Dry-run performs no writes; a missing baseline is not fatal.
    if command -v docker >/dev/null 2>&1 \
       && docker ps --format '{{.Names}}' 2>/dev/null | grep -qiE 'maria|mysql'; then
      warn "A live DB looks available — a real run would dump it to database/dump.sql"
    else
      warn "No live DB — a real run would build a baseline from prisma/migrations"
    fi
    SQL_INPUT=""
    return 0
  fi

  if gen_sql_from_live_db || gen_sql_baseline; then
    SQL_INPUT="$ROOT/database/dump.sql"
    ok "SQL input ready: database/dump.sql ($(wc -l < "$SQL_INPUT" | tr -d ' ') lines)"
    return 0
  fi

  die "Unable to find or auto-generate migration.sql / database/dump.sql"
}

# ─── Preflight checks ───
log "0/12 Preflight checks"
command -v zip >/dev/null 2>&1 || die "'zip' is required (apt install zip)"
command -v npx >/dev/null 2>&1 || die "'npx' is required (Node.js)"
if [ "$DRY_RUN" = true ]; then
  command -v docker >/dev/null 2>&1 || warn "'docker' missing (not needed for --dry-run)"
  command -v python3 >/dev/null 2>&1 || die "'python3' is required for cPanel provisioning"
else
  command -v docker >/dev/null 2>&1 || die "'docker' is required for temporary DB"
fi

[ -f "$BACKEND/package.json" ]      || die "backend/package.json not found — run from project root"
[ -f "$BACKEND/app.js" ]            || die "backend/app.js (Passenger entry) missing"
[ -f "$BACKEND/prisma/schema.prisma" ] || die "backend/prisma/schema.prisma missing"
[ -f "$BACKEND/prisma/seed.js" ]    || die "backend/prisma/seed.js missing"
[ -f "$BACKEND/.env.example" ]      || die "backend/.env.example missing"
[ -f "$ROOT/DEPLOY_CPANEL.md" ]     || die "DEPLOY_CPANEL.md not found in project root"
[ -f "$ROOT/deploy_cpanel.py" ]     || die "deploy_cpanel.py not found in project root"

# SQL schema input: prefer migration.sql, else database/dump.sql, else
# auto-generate (live DB dump, or a prisma-migrations schema baseline).
SQL_INPUT=""
ensure_sql_input
[ -f "$OUT" ] && rm -f "$OUT"

ok "All required files present"

# ─── Dry-run: validate preflight + print the provisioning plan, then stop ───
if [ "$DRY_RUN" = true ]; then
  log "DRY-RUN — no build, no database, no remote changes"
  info "This validates the pack + cPanel provisioning workflow without side effects."
  PROV_DUMP="$SQL_INPUT"
  if [ -z "$PROV_DUMP" ]; then
    PROV_DUMP="$(ls "$BACKEND"/prisma/migrations/*/migration.sql 2>/dev/null | head -1 || true)"
  fi
  [ -n "$PROV_DUMP" ] || PROV_DUMP="$ROOT/database/dump.sql"
  info "Invoking: python3 deploy_cpanel.py --dry-run --dump '$PROV_DUMP'"
  python3 "$ROOT/deploy_cpanel.py" --dry-run --dump "$PROV_DUMP" --env-out "$BACKEND/.env"
  echo ""
  echo -e "${BOLD}${GREEN}✓ Dry-run complete — workflow is valid.${NC}"
  echo -e "${CYAN}  Run 'bash pack-cpanel.sh --provision' to build + provision for real.${NC}"
  exit 0
fi

# ─── Step 1: Start temporary MariaDB ───
log "1/12 Starting temporary MariaDB container"
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
# SEED_FORCE=1 is SAFE HERE and required every pack: the build DB was just
# reset by `prisma migrate reset --force`, so there is nothing to destroy —
# the flag only makes the seed bypass its production-side "already has data"
# guard. The seed then wipes FK-dependents first (no orphans) and inserts
# fresh UUIDs / unique slugs (no primary-key collisions). If the flag is ever
# removed, a stale DB inside the build container would silently skip seeding
# and pack old data.
export SEED_FORCE=1
info "DATABASE_URL configured for build (SEED_FORCE=1 → clean Pokémon TCG master-data reseed)"

# ─── Step 3: Ensure local build deps, then generate Prisma Client ───
# NOTE: prisma/@prisma/client are devDependencies (and NODE_ENV=production is
# already exported for the seed), so the build-machine install must explicitly
# include dev deps for the Prisma CLI to be present.
log "Generating Prisma Client locally (npx prisma generate)"
if [ ! -x "$BACKEND/node_modules/.bin/prisma" ] && [ ! -x "$ROOT/node_modules/.bin/prisma" ]; then
  info "Installing backend build dependencies (prisma CLI)…"
  if [ -f "$BACKEND/package-lock.json" ]; then
    (cd "$BACKEND" && npm ci --include=dev --no-audit --no-fund)
  else
    (cd "$BACKEND" && npm install --include=dev --no-audit --no-fund)
  fi
fi
(cd "$BACKEND" && npx prisma generate)
[ -f "$BACKEND/src/generated/prisma/index.js" ] || die "Prisma client generation failed"
ENGINES=$(find "$BACKEND/src/generated/prisma" -name 'libquery_engine-*.so.node' 2>/dev/null | wc -l)
[ "$ENGINES" -ge 3 ] || die "Expected query engine binaries, found $ENGINES"
ok "Prisma Client generated ($ENGINES engine binaries)"

# ─── Step 4: Force-apply schema migrations ───
log "3/12 Applying Prisma schema migrations (prisma migrate reset --force)"
(cd "$BACKEND" && npx prisma migrate reset --force --skip-seed)
# Confirmation pass: `migrate deploy` must report nothing pending — guarantees
# the packaged DB schema and the migration files in backend/prisma/migrations
# are exactly in sync before seeding.
(cd "$BACKEND" && npx prisma migrate deploy)
(cd "$BACKEND" && npx prisma migrate status) | grep -qi "Database schema is up to date" \
  || die "Migrations not fully applied — refusing to seed/pack a drifted schema"
ok "Schema migrated successfully (migrate deploy + status clean)"

# ─── Step 5: Run database seeding (Pokémon TCG master data) ───
log "4/12 Seeding database (prisma db seed → prisma/seed.js)"
(cd "$BACKEND" && npx prisma db seed)
ok "Database seeded successfully"

# ─── Step 6: Verify seeded master data is clean Pokémon-only ───
log "5/12 Verifying seeded master data (no legacy rows / no orphans)"
DB_QUERY() { docker exec "$DB_CONTAINER_NAME" mariadb -u root -p"$DB_ROOT_PASS" -h 127.0.0.1 -N -B -e "$1" "$DB_NAME" 2>/dev/null; }

LEGACY_HITS=$(DB_QUERY "SELECT COUNT(*) FROM Product WHERE slug LIKE '%blue-eyes%' OR slug LIKE '%magician%' OR slug LIKE '%ragavan%' OR slug LIKE '%horizons%' OR cardSet LIKE '%Yu-Gi-Oh%' OR cardSet LIKE '%Magic:%' OR cardSet LIKE '%Blue Eyes%'")
[ "${LEGACY_HITS:-0}" -eq 0 ] || die "Seed verification failed: $LEGACY_HITS legacy non-Pokémon product(s) found in build DB"

ORPHAN_PRODUCTS=$(DB_QUERY "SELECT COUNT(*) FROM Product p LEFT JOIN Category c ON p.categoryId = c.id WHERE p.categoryId IS NULL OR c.id IS NULL")
[ "${ORPHAN_PRODUCTS:-0}" -eq 0 ] || die "Seed verification failed: $ORPHAN_PRODUCTS orphan product(s) (product→category FK broken)"

ORPHAN_VARIANTS=$(DB_QUERY "SELECT COUNT(*) FROM ProductVariant v LEFT JOIN Product p ON v.productId = p.id WHERE p.id IS NULL")
[ "${ORPHAN_VARIANTS:-0}" -eq 0 ] || die "Seed verification failed: $ORPHAN_VARIANTS orphan variant(s)"

DUP_SLUGS=$(DB_QUERY "SELECT COUNT(*) FROM (SELECT slug FROM Product GROUP BY slug HAVING COUNT(*) > 1) d")
[ "${DUP_SLUGS:-0}" -eq 0 ] || die "Seed verification failed: $DUP_SLUGS duplicated product slug(s)"

SET_COUNT=$(DB_QUERY 'SELECT COUNT(*) FROM `Set`')
[ "${SET_COUNT:-0}" -ge 7 ] || die "Seed verification failed: only $SET_COUNT expansion sets (expected ≥ 7 Pokémon TCG sets)"
PROD_COUNT=$(DB_QUERY "SELECT COUNT(*) FROM Product")
[ "${PROD_COUNT:-0}" -ge 5 ] || die "Seed verification failed: only $PROD_COUNT products (expected ≥ 5 sample products)"
RARITY_ODD=$(DB_QUERY "SELECT COUNT(*) FROM Product WHERE rarity IS NOT NULL AND rarity NOT IN ('Common (C)','Uncommon (U)','Rare (R)','Double Rare (RR)','Illustration Rare (IR)','Special Illustration Rare (SAR)','Ultra Rare (UR)','Hyper Rare (HR)','ACE SPEC')")
[ "${RARITY_ODD:-0}" -eq 0 ] || die "Seed verification failed: $RARITY_ODD product(s) carry non-canonical rarity values (corrupts filter dropdowns)"

ok "Master data clean: $SET_COUNT sets, $PROD_COUNT products, 0 legacy rows, 0 orphans, rarities canonical"

# ─── Step 7: Dump populated database to SQL ───
log "6/12 Dumping populated database to seed.sql"
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

# Also create a clean version with only data (for easy import).
# --insert-ignore keeps the data-only re-import PK-safe: rows already present
# are skipped instead of aborting the import or clobbering FK children.
DUMP_DATA_ONLY="$STAGE/seed-data.sql"
docker exec "$DB_CONTAINER_NAME" \
  mariadb-dump \
  -u root -p"$DB_ROOT_PASS" \
  -h 127.0.0.1 \
  --single-transaction \
  --no-create-info \
  --complete-insert \
  --insert-ignore \
  --skip-add-locks \
  --skip-lock-tables \
  "$DB_NAME" > "$DUMP_DATA_ONLY" 2>/dev/null || true

# Verify dump has content
[ -s "$DUMP_FILE" ] || die "Database dump is empty"
LINES=$(wc -l < "$DUMP_FILE")
ok "Database dumped to seed.sql ($LINES lines)"

# Persist the dump at database/dump.sql so deploy_cpanel.py can auto-detect it
# (and so the cPanel auto-import step has a stable, well-known dump path).
mkdir -p "$ROOT/database"
cp "$DUMP_FILE" "$ROOT/database/dump.sql"
cp "$DUMP_DATA_ONLY" "$ROOT/database/seed-data.sql" 2>/dev/null || true
info "Dump copied to database/dump.sql (for automated cPanel import)"

# ─── Step 8: Build frontend ───
log "7/12 Building frontend (Vite production bundle)"
# npm WORKSPACES: devDeps are hoisted, and frontend/node_modules/ can exist yet
# be EMPTY — testing the directory alone silently skipped the install, so the
# build died with "vite: not found" (step 7/12) and the script never reached
# the backend node_modules bundling. Probe the real binary instead, and install
# from the WORKSPACE ROOT with --include=dev: NODE_ENV=production (exported
# above for the seed) makes npm omit devDependencies, but the build toolchain
# (vite, @vitejs/plugin-react, tailwindcss, postcss) lives there.
if [ ! -x "$FRONTEND/node_modules/.bin/vite" ] && [ ! -x "$ROOT/node_modules/.bin/vite" ]; then
  info "Installing frontend build dependencies (vite + toolchain, devDeps included)..."
  if [ -f "$ROOT/package-lock.json" ]; then
    (cd "$ROOT" && npm ci --include=dev --no-audit --no-fund) \
      || (cd "$ROOT" && npm install --include=dev --no-audit --no-fund)
  else
    (cd "$ROOT" && npm install --include=dev --no-audit --no-fund)
  fi
fi
(cd "$FRONTEND" && npm run build)
[ -f "$FRONTEND/dist/index.html" ] || die "Frontend build failed (dist/index.html missing)"
ok "Frontend built successfully"

# ─── Step 9: Verify no server-side Prisma hooks ───
log "8/12 Verifying no server-side Prisma hooks in package.json"
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

# ─── Step 10: Stage backend production files ───
log "9/12 Staging backend production files"
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

# ─── Step 10b: Install PRODUCTION node_modules into the staged backend ───
# cPanel Node.js Selector / Passenger never runs a (re)install that can see
# these files, so `require('express')` failed at boot with
# "Cannot find module 'express'". Everything the runtime needs is bundled
# here instead: install into the staging copy (NOT the repo working tree) so
# the archive is the single source of truth, deterministic from the lockfile,
# and free of devDependencies (nodemon/prisma/@prisma/client stay out — the
# Prisma client already ships pre-built under src/generated/prisma).
log "9/12 Installing production dependencies into the artifact"
info "npm ci --omit=dev in $STAGE/backend (dev deps excluded, no scripts)"
(
  cd "$STAGE/backend" &&
  if [ -f package-lock.json ]; then
    npm ci --omit=dev --no-audit --no-fund --ignore-scripts
  else
    warn "package-lock.json missing — falling back to a non-deterministic install"
    npm install --omit=dev --no-audit --no-fund --ignore-scripts
  fi
) || die "npm production install failed — cannot bundle node_modules"

# Every runtime dependency actually required by app.js / src/** must resolve.
PROD_DEPS=$(node -e "
  const p = require('$STAGE/backend/package.json');
  console.log(Object.keys(p.dependencies || {}).join('\n'));
")
[ -n "$PROD_DEPS" ] || die "backend/package.json declares no production dependencies"
MISSING=""
while IFS= read -r dep; do
  [ -n "$dep" ] || continue
  [ -d "$STAGE/backend/node_modules/$dep" ] || MISSING="$MISSING $dep"
done <<< "$PROD_DEPS"
[ -z "$MISSING" ] || die "Missing from bundled node_modules:$MISSING"
[ -d "$STAGE/backend/node_modules/express" ] || die "express not bundled — cPanel boot would fail"

# Byte-level proof that the server can resolve express from the artifact root.
(cd "$STAGE/backend" && node -e "require.resolve('express')" >/dev/null 2>&1) \
  || die "express is not resolvable from backend/ in the staged artifact"
(cd "$STAGE/backend" && node -e "require.resolve('./src/config/prisma')" >/dev/null 2>&1) \
  || die "Prisma client is not resolvable from backend/ in the staged artifact"

NM_FILES=$(find "$STAGE/backend/node_modules" -type f | wc -l)
NM_SIZE=$(du -sh "$STAGE/backend/node_modules" | cut -f1)
[ "$NM_FILES" -gt 100 ] || die "Bundled node_modules looks empty ($NM_FILES files)"
ok "Production node_modules bundled ($NM_SIZE, $NM_FILES files) — express + Prisma client resolve"

# ─── Step 11: Write server configs & copy SQL dump ───
log "10/12 Writing server configs & copying SQL dump"

# .npmrc guard
cat > "$STAGE/backend/.npmrc" <<'NPMRC'
# Server-side guard: the generated Prisma client ships pre-built in
# src/generated/prisma; no package lifecycle script (esp. any prisma
# postinstall / engine download / Wasm schema validation) may run here.
ignore-scripts=true
NPMRC

# Copy the schema reference - seed.sql is already in STAGE from the dump.
# Prefer an explicit migration.sql; fall back to the SQL input detected earlier.
SCHEMA_INPUT="$SQL_INPUT"
[ -n "$SCHEMA_INPUT" ] || SCHEMA_INPUT="$ROOT/migration.sql"
cp "$SCHEMA_INPUT" "$STAGE/migration.sql"
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

# ─── Step 12: Write .htaccess and zip ───
log "11/12 Writing Apache .htaccess"
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

log "12/12 Creating final archive: $(basename "$OUT")"
# seed-data.sql ships alongside seed.sql: INSERT IGNORE-form data-only dump,
# safe to re-import into an already-seeded DB without PK collisions.
# node_modules is inside backend/ and ships recursively — cPanel gets a
# ready-to-boot app, no server-side npm install required.
(cd "$STAGE" && zip -qr9 "$OUT" .htaccess .env.production DEPLOY_CPANEL.md migration.sql seed.sql seed-data.sql backend)

# ─── Archive structure verification ───
# cPanel Node.js Selector / Passenger expects, relative to the app root:
#   app.js, package.json, prisma/, node_modules/  (+ src/generated/prisma).
log "Verifying final archive structure"
ARCHIVE_LIST=$(unzip -Z1 "$OUT")
verify_in_archive() {
  # Herestring, NOT `echo | grep -q`: under `set -o pipefail` an early match
  # makes grep exit first, echo takes SIGPIPE, and the pipeline returns 141 —
  # so a present path (express sits ~line 1738 of 2384) was reported missing.
  grep -q "$1" <<< "$ARCHIVE_LIST" || die "Archive missing required path: $1"
}
verify_in_archive '^backend/app\.js$'
verify_in_archive '^backend/package\.json$'
verify_in_archive '^backend/prisma/schema\.prisma$'
verify_in_archive '^backend/node_modules/express/package\.json$'
verify_in_archive '^backend/src/generated/prisma/index\.js$'
verify_in_archive '^backend/public/index\.html$'
verify_in_archive '^\.htaccess$'
NM_COUNT=$(echo "$ARCHIVE_LIST" | grep -c '^backend/node_modules/' || true)
[ "$NM_COUNT" -gt 100 ] || die "Archive bundles only $NM_COUNT node_modules entries"
ok "Archive verified: app.js, package.json, prisma/, node_modules/ ($NM_COUNT entries), generated Prisma client, public/ SPA"

echo ""
echo -e "${BOLD}${GREEN}✓ Pack complete: $OUT ($(du -sh "$OUT" | cut -f1))${NC}"
unzip -l "$OUT" | tail -3
echo ""
echo "Archive contents:"
echo "  backend/              → API + PRE-BUILT src/generated/prisma + prisma/ + pre-built public/ SPA"
echo "  backend/node_modules/ → PRODUCTION deps bundled (express, helmet, jsonwebtoken, …) — no install needed"
echo "  migration.sql         → Schema-only reference (original)"
echo "  seed.sql              → FULL schema + seeded data (NEW - for phpMyAdmin import)"
echo "  seed-data.sql         → Data-only insert statements (optional)"
echo "  DEPLOY_CPANEL.md      → GUI-only manual setup guide"
echo "  .env.production       → Template of required environment variables"
echo "  .htaccess             → Apache config (routes /api & /socket.io through Passenger)"
echo ""
echo -e "${BOLD}Server-side execution is pure runtime: no npm install, no prisma generate, no build steps.${NC}"
echo -e "${CYAN}Import seed.sql via phpMyAdmin to get a fully populated database.${NC}"

# ─── Step 13: Automated cPanel database provisioning + SQL auto-import ───
# Creates the DB, DB user, and grants ALL PRIVILEGES via the cPanel UAPI, then
# auto-imports database/dump.sql and (re)writes backend/.env with the new
# credentials. Zero cPanel web-interface actions required.
if [ "$PROVISION" = true ]; then
  log "13/13 cPanel database provisioning & auto-import (deploy_cpanel.py)"
  if ! command -v python3 >/dev/null 2>&1; then
    die "python3 is required for cPanel provisioning"
  fi
  PROV_DUMP="$ROOT/database/dump.sql"
  [ -f "$PROV_DUMP" ] || PROV_DUMP="$STAGE/seed.sql"
  python3 "$ROOT/deploy_cpanel.py" --dump "$PROV_DUMP" --env-out "$BACKEND/.env"
  ok "cPanel database provisioned, dump imported, backend/.env updated"
else
  echo ""
  echo -e "${CYAN}Database not auto-provisioned. To provision via cPanel UAPI + auto-import:${NC}"
  echo -e "${CYAN}  1) cp .env.cpanel.deploy.example .env.cpanel.deploy   # fill in cPanel API token${NC}"
  echo -e "${CYAN}  2) bash pack-cpanel.sh --provision${NC}"
fi