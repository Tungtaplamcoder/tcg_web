#!/bin/bash
# =============================================================================
# Database Restore Script for TCG E-Commerce Platform
# =============================================================================
# Restores a MariaDB/MySQL database from a backup file created by backup.sh
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

# Connection parameters come from DB_* variables in .env (never hardcoded)
if [ -z "${DB_NAME:-}" ] || [ -z "${DB_USER:-}" ]; then
    echo -e "${RED}Error: DB_USER / DB_NAME not set in .env${NC}"
    exit 1
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"

# Prefer mariadb client, fall back to mysql
if command -v mariadb >/dev/null 2>&1; then
    SQL_CMD="mariadb"
elif command -v mysql >/dev/null 2>&1; then
    SQL_CMD="mysql"
else
    echo -e "${RED}Error: mariadb / mysql client not found${NC}"
    exit 1
fi

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

echo -e "${BLUE}Restoring database...${NC}"

# Credentials passed via MYSQL_PWD (never on the command line)
if MYSQL_PWD="$DB_PASS" "$SQL_CMD" \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --user="$DB_USER" \
    "$DB_NAME" < "$BACKUP_FILE"; then
    echo -e "${GREEN}✓ Database restored successfully!${NC}"
else
    echo -e "${RED}✗ Restore failed!${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
