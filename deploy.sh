#!/usr/bin/env bash
# =============================================================================
# One-shot, zero-config deploy script for the TCG E-Commerce platform.
# Run from the project root (the folder that contains docker-compose.yml).
# =============================================================================
set -euo pipefail

echo "==> Building and starting all containers..."
docker compose up -d --build

echo "==> Waiting for the backend container to be ready..."
for i in $(seq 1 30); do
  if docker compose exec backend sh -c "node -e \"require('http').get('http://localhost:4000/health',r=>process.exit(r.statusCode===200?0:1))\" 2>/dev/null" >/dev/null 2>&1; then
    echo "    backend is healthy."
    break
  fi
  echo "    waiting for backend... ($i/30)"
  sleep 3
done

echo "==> Applying database schema (Prisma)..."
# This repo ships no prisma/migrations/ folder, so create the schema from
# schema.prisma directly. If you later add migrations, `migrate deploy` runs
# first and db push simply reports "in sync".
docker compose exec backend npx prisma migrate deploy 2>/dev/null || true
docker compose exec backend npx prisma db push --skip-generate

echo "==> Seeding initial admin user and data..."
docker compose exec backend node prisma/seed.js || echo "    (seed skipped or already seeded)"

echo "==> Live container health status:"
docker compose ps

echo ""
echo "==> DONE. Open the app at: http://localhost"
echo "    - Frontend (direct): http://localhost:3000"
echo "    - Backend API:       http://localhost:4000/api/v1"
echo "    - Admin login:       admin@tcg.local / AdminSecurePass123!"
