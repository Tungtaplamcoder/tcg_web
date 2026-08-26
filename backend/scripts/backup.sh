#!/bin/bash
# =============================================================================
# Database Backup Script for TCG E-Commerce Platform
# =============================================================================
# Creates a timestamped PostgreSQL database backup using pg_dump
# Usage: ./scripts/backup.sh [custom_backup_name]
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
elif [ -f "../.env" ]; then
    export $(grep -v '^#' ../.env | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Parse DATABASE_URL to extract connection parameters
# Format: postgresql://user:password@host:port/database?schema=public
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}Error: DATABASE_URL not set in .env${NC}"
    exit 1
fi

# Extract connection parameters from DATABASE_URL
# Remove protocol
DB_URL="${DATABASE_URL#postgresql://}"
DB_URL="${DB_URL#postgres://}"

# Extract user:password@host:port/database
if [[ "$DB_URL" == *"@"* ]]; then
    AUTH_PART="${DB_URL%%@*}"
    DB_USER="${AUTH_PART%%:*}"
    DB_PASS="${AUTH_PART#*:}"
    HOST_PART="${DB_URL#*@}"
else
    # No auth in URL
    DB_USER="${PGUSER:-postgres}"
    DB_PASS="${PGPASSWORD:-}"
    HOST_PART="$DB_URL"
fi

# Extract host:port/database
DB_HOST="${HOST_PART%%:*}"
PORT_DB="${HOST_PART#*:}"
DB_PORT="${PORT_DB%%/*}"
DB_NAME="${PORT_DB#*/}"
DB_NAME="${DB_NAME%%\?*}" # Remove query parameters

# Set defaults
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-tcg_db}"

# Backup directory
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

# Timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Backup filename
if [ $# -eq 1 ]; then
    BACKUP_FILE="${BACKUP_DIR}/${1}_${TIMESTAMP}.sql"
else
    BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Database Backup Started${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Database: ${GREEN}$DB_NAME${NC}"
echo -e "Host:     ${GREEN}$DB_HOST:$DB_PORT${NC}"
echo -e "User:     ${GREEN}$DB_USER${NC}"
echo -e "Output:   ${GREEN}$BACKUP_FILE${NC}"
echo -e "${BLUE}========================================${NC}"

# Set PGPASSWORD for pg_dump
export PGPASSWORD="$DB_PASS"

# Run pg_dump
# --no-owner: Don't output commands to set ownership
# --no-privileges: Don't output GRANT/REVOKE commands
# --clean: Drop objects before creating them
# --if-exists: Use IF EXISTS when dropping objects
# --format=custom: Use custom format (compressed, allows parallel restore)
# --verbose: Verbose output
if pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --format=custom \
    --verbose \
    --file="$BACKUP_FILE"; then
    
    # Get file size
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    
    echo -e "${GREEN}✓ Backup completed successfully!${NC}"
    echo -e "File: ${GREEN}$BACKUP_FILE${NC} (${FILE_SIZE})"
    echo -e "${BLUE}========================================${NC}"
    
    # Create a latest symlink for convenience
    LATEST_LINK="${BACKUP_DIR}/latest_${DB_NAME}.sql"
    ln -sf "$(basename "$BACKUP_FILE")" "$LATEST_LINK"
    echo -e "Latest symlink: ${GREEN}$LATEST_LINK${NC}"
else
    echo -e "${RED}✗ Backup failed!${NC}"
    exit 1
fi