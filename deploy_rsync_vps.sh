#!/bin/bash
# deploy_rsync_vps.sh - VPS-side deployment handler for rsync sync
echo "🚀 Starting VPS Deployment (Rsync Mode)..."

BACKEND_DIR="/var/www/bdapp"
cd $BACKEND_DIR

echo "🔑 Setting proper permissions..."
chown -R www-data:www-data $BACKEND_DIR
find $BACKEND_DIR -type d -exec chmod 755 {} \;
find $BACKEND_DIR -type f -exec chmod 644 {} \;

cd $BACKEND_DIR

if [ ! -d ".venv" ]; then
    echo "📦 Virtualenv not found. Creating one..."
    python3 -m venv .venv
fi

VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"
VENV_PIP="$BACKEND_DIR/.venv/bin/pip"

echo "📦 Syncing dependencies..."
$VENV_PIP install --upgrade pip
$VENV_PIP install --no-cache-dir -r requirements.txt
$VENV_PIP install gunicorn daphne

echo "🚀 Running Migrations..."
$VENV_PYTHON manage.py makemigrations --noinput
if ! $VENV_PYTHON manage.py migrate --noinput; then
    echo "⚠️ Standard migration failed. Attempting with --run-syncdb..."
    $VENV_PYTHON manage.py migrate --run-syncdb --noinput
fi

echo "📂 Collecting Static Files..."
$VENV_PYTHON manage.py collectstatic --noinput

echo "🔄 Restarting Services..."
systemctl daemon-reload
systemctl stop gunicorn gunicorn.socket daphne 2>/dev/null
systemctl start gunicorn.socket
systemctl start gunicorn
systemctl start daphne

echo "✅ Rsync Deployment Complete! Services restarted."
