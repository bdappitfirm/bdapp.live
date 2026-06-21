#!/bin/bash
# deploy_rsync_vps.sh - VPS-side deployment handler
echo "🚀 Starting VPS Deployment..."

BACKEND_DIR="/var/www/bdapp"
cd $BACKEND_DIR

echo "🔑 Setting proper permissions..."
chown -R www-data:www-data $BACKEND_DIR
chmod -R 755 $BACKEND_DIR

if [ ! -d ".venv" ]; then
    echo "📦 Creating Virtualenv..."
    python3 -m venv .venv
fi

VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"
VENV_PIP="$BACKEND_DIR/.venv/bin/pip"

echo "📦 Syncing dependencies..."
$VENV_PIP install -r requirements.txt
$VENV_PIP install gunicorn daphne

echo "🚀 Running Migrations..."
$VENV_PYTHON manage.py migrate --noinput

echo "📁 Collecting Static Files..."
$VENV_PYTHON manage.py collectstatic --noinput

echo "🔄 Restarting Services..."
systemctl daemon-reload
systemctl restart gunicorn.socket
systemctl restart gunicorn
systemctl restart daphne
systemctl restart nginx

echo "✅ Deployment Complete!"
