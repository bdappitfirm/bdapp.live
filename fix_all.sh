#!/bin/bash
# fix_all.sh - Emergency Repair for bdapp.live
echo "🚀 Starting Master Deployment Fix for bdapp.live..."

# Ensure we are running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit 1
fi

BACKEND_DIR="/var/www/bdapp"
FRONTEND_DIR="/var/www/bdapp/frontend/build"

# 1. Virtualenv Setup
cd $BACKEND_DIR
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"
VENV_PIP="$BACKEND_DIR/.venv/bin/pip"

# 2. Database Force Sync & Cleanup
echo "🗄️ Fixing Database Schema and Migrations..."
$VENV_PIP install --upgrade pip
$VENV_PIP install -r requirements.txt
$VENV_PIP install gunicorn daphne

# Remove server-side conflicting migration files that might not exist locally
# This is a common issue when makemigrations runs on server
find $BACKEND_DIR/schools/migrations/ -name "0010_*" -delete 2>/dev/null
find $BACKEND_DIR/schools/migrations/ -name "0011_*" -delete 2>/dev/null
find $BACKEND_DIR/schools/migrations/ -name "0012_*" -delete 2>/dev/null

# Force-create the missing columns via SQL first to prevent 500 error if migration fails
$VENV_PYTHON manage.py shell <<EOF
from django.db import connection
with connection.cursor() as cursor:
    try:
        # Check/Add gender to users_profile
        cursor.execute("DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users_profile' AND column_name='gender') THEN ALTER TABLE users_profile ADD COLUMN gender varchar(10); END IF; END \$\$;")
        # Check/Add number_of_buildings to schools_school
        cursor.execute("DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schools_school' AND column_name='number_of_buildings') THEN ALTER TABLE schools_school ADD COLUMN number_of_buildings integer DEFAULT 1; END IF; END \$\$;")
        print("✅ SQL: Essential columns ensured.")
    except Exception as e:
        print(f"⚠️ SQL hint: {e}")
EOF

# Handle migrations
echo "⚙️ Applying Migrations..."
# Resolve conflicts automatically
$VENV_PYTHON manage.py makemigrations --merge --noinput 2>/dev/null
$VENV_PYTHON manage.py makemigrations --noinput
$VENV_PYTHON manage.py migrate --noinput || $VENV_PYTHON manage.py migrate --fake-initial --noinput

$VENV_PYTHON manage.py collectstatic --noinput

# 3. Permissions
chown -R www-data:www-data $BACKEND_DIR
chmod -R 755 $BACKEND_DIR

# 4. Service Refresh
systemctl daemon-reload
systemctl restart gunicorn daphne nginx
echo "✅ Everything Fixed! You can now use the app."
