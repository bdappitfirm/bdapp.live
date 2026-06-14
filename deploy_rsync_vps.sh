#!/bin/bash
# deploy_rsync_vps.sh - VPS-side deployment handler for rsync sync
echo "ðŸš€ Starting VPS Deployment (Rsync Mode)..."

BACKEND_DIR="/var/www/bdapp"
cd $BACKEND_DIR

echo "ðŸ”‘ Setting proper permissions..."
chown -R www-data:www-data $BACKEND_DIR
find $BACKEND_DIR -type d -exec chmod 755 {} \;
find $BACKEND_DIR -type f -exec chmod 644 {} \;

cd $BACKEND_DIR

if [ ! -d ".venv" ]; then
    echo "ðŸ“¦ Virtualenv not found. Creating one..."
    python3 -m venv .venv
fi

VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"
VENV_PIP="$BACKEND_DIR/.venv/bin/pip"

echo "ðŸ“¦ Syncing dependencies..."
$VENV_PIP install --upgrade pip
$VENV_PIP install --no-cache-dir -r requirements.txt
$VENV_PIP install gunicorn daphne

echo "ðŸš€ Running Migrations..."
$VENV_PYTHON manage.py makemigrations --noinput
if ! $VENV_PYTHON manage.py migrate --noinput; then
    echo "âš ï¸ Standard migration failed. Attempting with --run-syncdb..."
    $VENV_PYTHON manage.py migrate --run-syncdb --noinput
fi

echo "ðŸ“‚ Collecting Static Files..."
$VENV_PYTHON manage.py collectstatic --noinput

echo "ðŸ”„ Restarting Services..."
systemctl daemon-reload
systemctl stop gunicorn gunicorn.socket daphne 2>/dev/null
systemctl start gunicorn.socket
systemctl start gunicorn
systemctl start daphne

echo "âœ… Rsync Deployment Complete! Services restarted."
