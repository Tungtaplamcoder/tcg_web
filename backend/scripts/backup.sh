#!/bin/bash
# =============================================================================
# Database Backup Script for TCG E-Commerce Platform
# =============================================================================
# Creates a timestamped MariaDB/MySQL backup using mariadb-dump (or mysqldump)
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

# Connection parameters come from DB_* variables in .env (never hardcoded)
if [ -z "${DB_NAME:-}" ] || [ -z "${DB_USER:-}" ]; then
    echo -e "${RED}Error: DB_USER / DB_NAME not set in .env${NC}"
    exit 1
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"

# Prefer mariadb-dump, fall back to mysqldump
if command -v mariadb-dump >/dev/null 2>&1; then
    DUMP_CMD="mariadb-dump"
elif command -v mysqldump >/dev/null 2>&1; then
    DUMP_CMD="mysqldump"
else
    echo -e "${RED}Error: mariadb-dump / mysqldump not found${NC}"
    exit 1
fi

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

# Run dump — credentials passed via MYSQL_PWD (never on the command line)
# --single-transaction: consistent snapshot without locking (InnoDB)
# --routines --triggers --events: include server-side objects
if MYSQL_PWD="$DB_PASS" "$DUMP_CMD" \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --user="$DB_USER" \
    --single-transaction \
    --routines --triggers --events \
    --no-tablespaces \
    "$DB_NAME" > "$BACKUP_FILE"; then

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
