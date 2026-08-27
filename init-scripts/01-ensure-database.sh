#!/bin/bash
# =============================================================================
# PostgreSQL Init Script - Ensures database exists
# =============================================================================
# This script runs on every PostgreSQL container startup to ensure
# the target database exists (useful when volume already has data from previous runs)
# =============================================================================

set -e

# Wait for PostgreSQL to be ready
until pg_isready -U "$POSTGRES_USER" -d "postgres"; do
  echo "Waiting for PostgreSQL to be ready..."
  sleep 2
done

# Check if target database exists, create if not
DB_EXISTS=$(psql -U "$POSTGRES_USER" -d "postgres" -tAc "SELECT 1 FROM pg_database WHERE datname='$POSTGRES_DB'")

if [ "$DB_EXISTS" != "1" ]; then
  echo "Database '$POSTGRES_DB' does not exist. Creating..."
  psql -U "$POSTGRES_USER" -d "postgres" -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\";"
  echo "Database '$POSTGRES_DB' created successfully."
else
  echo "Database '$POSTGRES_DB' already exists."
fi

# Ensure proper permissions
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "GRANT ALL ON SCHEMA public TO \"$POSTGRES_USER\";"
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"$POSTGRES_USER\";"

echo "Database initialization complete."