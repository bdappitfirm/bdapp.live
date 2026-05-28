#!/bin/bash
# restore_db.sh - Restore PostgreSQL database from backup

BACKUP_DIR="/var/www/bdapp/backups/db"
DB_NAME="local_pg_db"
DB_USER="local_pg_user"

echo "🚀 Starting Database Restore..."

# Stop services
echo "🔄 Stopping services..."
systemctl stop gunicorn gunicorn.socket daphne 2>/dev/null

# Find latest backup
if [ -d "$BACKUP_DIR" ]; then
    LATEST_BACKUP=$(ls -t $BACKUP_DIR/*.sql 2>/dev/null | head -1)
    if [ -z "$LATEST_BACKUP" ]; then
        LATEST_BACKUP=$(ls -t $BACKUP_DIR/*.dump 2>/dev/null | head -1)
    fi
fi

# Also check root directory for backups
if [ -z "$LATEST_BACKUP" ]; then
    LATEST_BACKUP=$(ls -t /var/www/bdapp/*.sql 2>/dev/null | head -1)
    if [ -z "$LATEST_BACKUP" ]; then
        LATEST_BACKUP=$(ls -t /var/www/bdapp/*.dump 2>/dev/null | head -1)
    fi
fi

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ ERROR: No backup file found!"
    echo "Please place your backup file (.sql or .dump) in /var/www/bdapp/ or /var/www/bdapp/backups/db/"
    exit 1
fi

echo "✅ Found backup: $LATEST_BACKUP"
echo "📦 Restoring database..."

# Restore based on file type
if [[ "$LATEST_BACKUP" == *.sql ]]; then
    sudo -u postgres psql -d $DB_NAME -f "$LATEST_BACKUP"
else
    sudo -u postgres pg_restore -d $DB_NAME "$LATEST_BACKUP"
fi

# Fix ownership
echo "🔑 Fixing database ownership..."
sudo -u postgres psql -d $DB_NAME <<EOF
REASSIGN OWNED BY postgres TO $DB_USER;
ALTER SCHEMA public OWNER TO $DB_USER;
EOF

# Restart services
echo "🚀 Restarting services..."
systemctl start gunicorn.socket
systemctl start gunicorn
systemctl start daphne

echo "✅ Database Restore Complete!"
