#!/bin/bash
# fix_all.sh - Routine Update Script (Optimized)
set -e

BACKEND_DIR="/var/www/bdapp"
VENV_PYTHON="$BACKEND_DIR/.venv/bin/python3"

echo "🚀 Starting Routine Update..."

cd $BACKEND_DIR

# 1. Normal Database Sync (Only applies NEW changes if any)
echo "⚙️ Syncing database..."
# If migration 0010 fails due to existing constraint, we fake it
$VENV_PYTHON manage.py migrate --noinput || {
    echo "⚠️  Migration failed, attempting to fake conflicting migration..."
    $VENV_PYTHON manage.py migrate academics 0010 --fake --noinput 2>/dev/null
    $VENV_PYTHON manage.py migrate --noinput
}

# 1.5 Fix existing database marks and recalculate grades
if [ -f "fix_database_marks.py" ]; then
    echo "🧹 Auditing and fixing database marks..."
    $VENV_PYTHON fix_database_marks.py
fi

# 1.6 Fix optional subjects for Class 9-10
if [ -f "fix_optional_subjects.py" ]; then
    echo "🌱 Fixing optional subjects for Class 9-10..."
    $VENV_PYTHON fix_optional_subjects.py
fi

# 2. Update Static Files (Needed for CSS/JS changes)
echo "🎨 Updating static files..."
$VENV_PYTHON manage.py collectstatic --noinput

# 3. Permissions Check (Fast)
echo "🔧 Ensuring permissions..."
chown -R www-data:www-data $BACKEND_DIR
chmod +x $BACKEND_DIR/.venv/bin/* 2>/dev/null || true

# 4. Restart Services
echo "🔄 Restarting Gunicorn & Daphne..."
systemctl restart gunicorn daphne

echo "✅ Update Successful! No unnecessary cleanup performed."
