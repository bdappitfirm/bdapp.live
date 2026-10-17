#!/bin/bash
set -e

# Create directories
mkdir -p /var/www/bdapp
mkdir -p /var/www/bdapp/frontend/build

# Extract backend
tar -xf /root/backend_minimal.tar -C /var/www/bdapp/

# Create .env file
cat <<EOF > /var/www/bdapp/.env
DEBUG=False
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')
PG_NAME=local_pg_db
PG_USER=local_pg_user
PG_PASSWORD=${PG_PASSWORD:?PG_PASSWORD must be exported before running deploy_setup.sh}
PG_HOST=localhost
PG_PORT=5432
USE_POSTGRES=True
ALLOWED_HOSTS=bdapp.live,www.bdapp.live,server.bdapp.live,138.252.124.52
EOF

# Extract frontend
tar -xzf /root/frontend.tar.gz -C /var/www/bdapp/frontend/build

# Setup backend virtualenv
cd /var/www/bdapp
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

# Run migrations and collectstatic
python manage.py collectstatic --noinput
python manage.py migrate academics --fake || true
python manage.py migrate --noinput

# Set permissions
chown -R www-data:www-data /var/www/bdapp
chmod -R 755 /var/www/bdapp
