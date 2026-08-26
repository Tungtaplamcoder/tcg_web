#!/bin/bash
# =============================================================================
# Database Restore Script for TCG E-Commerce Platform
# =============================================================================
# Restores a PostgreSQL database from a backup file created by backup.sh
# Usage: ./scripts/restore.sh <backup_file> [--force]
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FORCE=false

# Parse arguments
BACKUP_FILE=""
for arg in "$@"; do
    case $arg in
        --force)
            FORCE=true
            shift
            ;;
        *)
            if [ -z "$BACKUP_FILE" ]; then
                BACKUP_FILE="$arg"
            fi
            ;;
    esac
done

# Check if backup file is provided
if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: No backup file specified${NC}"
    echo -e "Usage: $0 <backup_file> [--force]"
    echo -e ""
    echo -e "Available backups in ./backups/:"
    ls -la ./backups/*.sql 2>/dev/null || echo "  No backups found"
    exit 1
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    # Try with ./backups/ prefix
    if [ -f "./backups/$BACKUP_FILE" ]; then
        BACKUP_FILE="./backups/$BACKUP_FILE"
    else
        echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
        exit 1
    fi
fi

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
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}Error: DATABASE_URL not set in .env${NC}"
    exit 1
fi

# Extract connection parameters from DATABASE_URL
DB_URL="${DATABASE_URL#postgresql://}"
DB_URL="${DB_URL#postgres://}"

if [[ "$DB_URL" == *"@"* ]]; then
    AUTH_PART="${DB_URL%%@*}"
    DB_USER="${AUTH_PART%%:*}"
    DB_PASS="${AUTH_PART#*:}"
    HOST_PART="${DB_URL#*@}"
else
    DB_USER="${PGUSER:-postgres}"
    DB_PASS="${PGPASSWORD:-}"
    HOST_PART="$DB_URL"
fi

DB_HOST="${HOST_PART%%:*}"
PORT_DB="${HOST_PART#*:}"
DB_PORT="${PORT_DB%%/*}"
DB_NAME="${PORT_DB#*/}"
DB_NAME="${DB_NAME%%\?*}"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-tcg_db}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Database Restore${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Database: ${GREEN}$DB_NAME${NC}"
echo -e "Host:     ${GREEN}$DB_HOST:$DB_PORT${NC}"
echo -e "User:     ${GREEN}$DB_USER${NC}"
echo -e "Backup:   ${GREEN}$BACKUP_FILE${NC}"
echo -e "${BLUE}========================================${NC}"

# Confirmation prompt unless --force is used
if [ "$FORCE" = false ]; then
    echo -e "${YELLOW}⚠ WARNING: This will OVERWRITE the database '$DB_NAME'!${NC}"
    echo -e "${YELLOW}⚠ All existing data will be LOST!${NC}"
    echo -e ""
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo -e "${RED}Restore cancelled.${NC}"
        exit 0
    fi
fi

# Set PGPASSWORD for pg_restore
export PGPASSWORD="$DB_PASS"

# Check backup file format
FILE_TYPE=$(file "$BACKUP_FILE" | cut -d: -f2 | xargs)

echo -e "${BLUE}Restoring database...${NC}"

# Restore based on file format
if [[ "$FILE_TYPE" == *"PostgreSQL custom database dump"* ]]; then
    # Custom format (from backup.sh)
    if pg_restore \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        --verbose \
        "$BACKUP_FILE"; then
        echo -e "${GREEN}✓ Database restored successfully from custom format!${NC}"
    else
        echo -e "${RED}✗ Restore failed!${NC}"
        exit 1
    fi
elif [[ "$FILE_TYPE" == *"ASCII text"* ]] || [[ "$FILE_TYPE" == *"UTF-8 Unicode text"* ]]; then
    # Plain SQL format
    if psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --file="$BACKUP_FILE" \
        --quiet; then
        echo -e "${GREEN}✓ Database restored successfully from SQL format!${NC}"
    else
        echo -e "${RED}✗ Restore failed!${NC}"
        exit 1
    fi
else
    echo -e "${RED}Error: Unknown backup file format: $FILE_TYPE${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"