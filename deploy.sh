#!/usr/bin/env bash
# =============================================================================
# One-shot, zero-config deploy script for the TCG E-Commerce platform.
# Run from the project root (the folder that contains docker-compose.yml).
#
# DATA SAFETY:
#   - This script NEVER wipes or resets the database.
#   - No `prisma migrate reset`, no `prisma db push --force-reset`,
#     no `docker compose down -v` (which removes volumes), no DROP DATABASE.
#   - Only additive, safe migrations are applied: `prisma migrate deploy`
#     (applies pending migrations) followed by `prisma db push --skip-generate`
#     (syncs schema drift without data loss; never passes --accept-data-loss).
#   - PostgreSQL data lives in the named volume `tcg_postgres_data` and is
#     preserved across every redeploy cycle.
# =============================================================================
set -euo pipefail

echo "==> Building and starting all containers..."
# `up -d` (NOT `down` / `down -v`) — containers are recreated in place while
# the postgres_data volume and all other volumes stay untouched.
docker compose up -d --build

echo "==> Waiting for the backend container to be ready..."
backend_ready=false
for i in $(seq 1 30); do
  if docker compose exec backend sh -c "node -e \"require('http').get('http://localhost:4000/health',r=>process.exit(r.statusCode===200?0:1))\" 2>/dev/null" >/dev/null 2>&1; then
    echo "    backend is healthy."
    backend_ready=true
    break
  fi
  echo "    waiting for backend... ($i/30)"
  sleep 3
done

if [ "$backend_ready" = false ]; then
  echo "ERROR: backend did not become healthy in time. Aborting BEFORE any DB step." >&2
  exit 1
fi

echo "==> Applying database schema (Prisma) — additive only, data is preserved..."
# 1) `prisma migrate deploy`: applies pending migrations from prisma/migrations.
#    This is the production-safe command: it never prompts, never resets data,
#    and is a no-op when the DB is already up to date.
# 2) `prisma db push --skip-generate`: syncs schema.prisma drift for the case
#    where a migration folder entry is missing. Without --force-reset or
#    --accept-data-loss it performs additive DDL only and refuses destructive
#    changes rather than dropping data.
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db push --skip-generate

echo "==> Seeding initial admin user (skips automatically if data already exists)..."
# seed.js is idempotent: it exits early when the database already has data,
# so redeploying never wipes users, orders, or products.
docker compose exec backend node prisma/seed.js || echo "    (seed skipped or already seeded)"

echo "==> Live container health status:"
docker compose ps

echo ""
echo "==> DONE. Open the app at: http://localhost"
echo "    - Frontend (direct): http://localhost:3000"
echo "    - Backend API:       http://localhost:4000/api/v1"
echo "    - Admin login:       admin@tcg.local / AdminSecurePass123!"
