#!/bin/bash
# fix_all.sh - Comprehensive deployment and fix script for bdapp.live
echo "🚀 Starting Master Deployment Fix for bdapp.live..."

# 1. Extraction (if new tars exist)
BACKEND_DIR="/var/www/bdapp/backend"
FRONTEND_DIR="/var/www/bdapp/frontend/build"

if [ -f "/root/backend_minimal.tar" ]; then
    echo "📦 Extracting Backend..."
    mkdir -p $BACKEND_DIR
    # Extract into PROJECT ROOT instead of directly backend folder
    mkdir -p /var/www/bdapp
    tar -xf /root/backend_minimal.tar -C /var/www/bdapp/
    
    # --- COPY LOCAL MEDIA from tar to server locations!
    if [ -d "/var/www/bdapp/media" ]; then
        echo "✅ Found LOCAL MEDIA from tar! Copying to all media locations..."
        cp -ar /var/www/bdapp/media/. $BACKEND_DIR/media/ 2>/dev/null || true
    fi
fi

# --- ULTIMATE MEDIA FIX ---
echo "📸 STARTING ULTIMATE MEDIA RESCUE!"

# List all possible media locations first
echo "🔍 SEARCHING FOR ALL MEDIA FILES..."
for CHECK in "/var/www/bdapp/media" "/var/www/bdapp/backend/media" "/root/media"
do
    if [ -d "$CHECK" ]; then
        echo "✅ Found media at $CHECK"
        echo "   Contents (first 20 files):"
        ls -la "$CHECK" 2>/dev/null | head -30
    fi
done

# 1. Ensure both media locations exist
mkdir -p /var/www/bdapp/media
mkdir -p $BACKEND_DIR/media

# 2. Copy everything from EVERY possible source
echo "🚚 COPYING ALL MEDIA FILES..."
for SOURCE in \
    "/var/www/bdapp/media" \
    "/var/www/bdapp/backend/media" \
    "/root/media" \
    "/root/backup/media"
do
    if [ -d "$SOURCE" ]; then
        echo "   Copying from $SOURCE..."
        cp -ar "$SOURCE/." /var/www/bdapp/media/ 2>/dev/null || true
        cp -ar "$SOURCE/." $BACKEND_DIR/media/ 2>/dev/null || true
    fi
done

# 3. Ensure all subdirectories exist in both locations
mkdir -p /var/www/bdapp/media/school_logos
mkdir -p /var/www/bdapp/media/school_ads
mkdir -p /var/www/bdapp/media/student_photos
mkdir -p /var/www/bdapp/media/user_photos
mkdir -p $BACKEND_DIR/media/school_logos
mkdir -p $BACKEND_DIR/media/school_ads
mkdir -p $BACKEND_DIR/media/student_photos
mkdir -p $BACKEND_DIR/media/user_photos

# 4. Set full permissions
echo "🔑 SETTING FULL MEDIA PERMISSIONS..."
chown -R www-data:www-data /var/www/bdapp/media
chown -R www-data:www-data $BACKEND_DIR/media
chmod -R 777 /var/www/bdapp/media
chmod -R 777 $BACKEND_DIR/media

# 5. Show final media structure
echo "✅ FINAL MEDIA CHECK:"
ls -la /var/www/bdapp/media/ 2>/dev/null || true

mkdir -p $BACKEND_DIR/staticfiles
mkdir -p $BACKEND_DIR/static

if [ -f "/root/frontend.tar.gz" ]; then
    echo "📦 Extracting Frontend..."
    mkdir -p $FRONTEND_DIR
    tar -xzf /root/frontend.tar.gz -C /var/www/bdapp/frontend/
    # If nested build/ exists, move it
    if [ -d "$FRONTEND_DIR/build" ]; then
        cp -r $FRONTEND_DIR/build/* $FRONTEND_DIR/
        rm -rf $FRONTEND_DIR/build
    fi
fi

# 2. Permissions (Fixed for Executables)
echo "🔑 Setting permissions for www-data..."
chown -R www-data:www-data /var/www/bdapp
find /var/www/bdapp -type d -exec chmod 755 {} \;
# Set files to 644 but KEEP binaries executable
find /var/www/bdapp -type f -exec chmod 644 {} \;

# Special permissions for media folder to allow uploads
chmod -R 775 $BACKEND_DIR/media
chown -R www-data:www-data $BACKEND_DIR/media

# Specifically ensure binaries in .venv/bin are executable
if [ -d "$BACKEND_DIR/.venv/bin" ]; then
    chmod -R 755 "$BACKEND_DIR/.venv/bin"
fi
# Ensure manage.py is executable
[ -f "$BACKEND_DIR/manage.py" ] && chmod 755 "$BACKEND_DIR/manage.py"

chmod +x /var /var/www /var/www/bdapp

# 3. Backend Setup
echo "⚙️ Running Backend Setup..."
cd $BACKEND_DIR

# Ensure .env exists with production settings
if [ -f "$BACKEND_DIR/backend/.env" ]; then
    echo "🚚 Moving existing .env from backend/ to root..."
    mv "$BACKEND_DIR/backend/.env" "$BACKEND_DIR/.env"
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "📝 Creating default .env file..."
    cat <<EOF > $BACKEND_DIR/.env
DEBUG=False
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')
PG_NAME=local_pg_db
PG_USER=local_pg_user
PG_PASSWORD=Bangladesh@4321$
PG_HOST=localhost
PG_PORT=5432
USE_POSTGRES=True
ALLOWED_HOSTS=bdapp.live,www.bdapp.live,api.bdapp.live,138.252.124.52
EOF
else
    # Ensure DEBUG is False and all hosts are allowed
    sed -i 's/DEBUG=True/DEBUG=False/g' $BACKEND_DIR/.env
    # Check if api.bdapp.live is in ALLOWED_HOSTS, if not add it
    if ! grep -q "api.bdapp.live" $BACKEND_DIR/.env; then
        sed -i 's/ALLOWED_HOSTS=/ALLOWED_HOSTS=api.bdapp.live,/g' $BACKEND_DIR/.env
    fi
fi

# Load variables from .env
export $(grep -v '^#' "$BACKEND_DIR/.env" | xargs)

# DEEP CLEAN: Recreate venv once to fix persistent Google namespace import errors
if [ ! -f "$BACKEND_DIR/.deep_clean_v6" ]; then
    echo "🧹 Performing DEEP CLEAN of Virtualenv and Cache..."
    rm -rf .venv
    rm -rf ~/.cache/pip
    touch $BACKEND_DIR/.deep_clean_v6
fi

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

echo "🔍 Checking Database Connection and Tables..."
$VENV_PYTHON manage.py shell <<'EOF'
from django.db import connection
try:
    connection.ensure_connection()
    tables = connection.introspection.table_names()
    print(f"✅ Database connection successful. Found {len(tables)} tables.")
    if 'schools_school' in tables:
        print("✅ 'schools_school' table exists.")
    else:
        print("⚠️ 'schools_school' table is MISSING!")
except Exception as e:
    print(f"❌ Database connection failed: {e}")
EOF

echo "🚀 Running Migrations..."
# Fix ownership issues in PostgreSQL more aggressively using psql directly as postgres user
echo "🔑 Fixing Database Ownership for all objects..."
sudo -u postgres psql -d $PG_NAME <<EOF
-- Reassign ownership of all tables, sequences, and views
DO \$\$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO "$PG_USER"';
    END LOOP;
    FOR r IN (SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'S') LOOP
        EXECUTE 'ALTER SEQUENCE public.' || quote_ident(r.relname) || ' OWNER TO "$PG_USER"';
    END LOOP;
    FOR r IN (SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'v') LOOP
        EXECUTE 'ALTER VIEW public.' || quote_ident(r.relname) || ' OWNER TO "$PG_USER"';
    END LOOP;
    -- Specifically fix index ownership which was causing the migration error
    FOR r IN (SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'i') LOOP
        EXECUTE 'ALTER INDEX public.' || quote_ident(r.relname) || ' OWNER TO "$PG_USER"';
    END LOOP;
END \$\$;
REASSIGN OWNED BY postgres TO "$PG_USER";
ALTER SCHEMA public OWNER TO "$PG_USER";
EOF

# Ensure the static directory exists
mkdir -p $BACKEND_DIR/static

$VENV_PYTHON manage.py makemigrations --noinput
if ! $VENV_PYTHON manage.py migrate --noinput; then
    echo "⚠️ Standard migration failed. Attempting with --run-syncdb as last resort..."
    $VENV_PYTHON manage.py migrate --run-syncdb --noinput
fi

echo "📂 Collecting Static Files..."
$VENV_PYTHON manage.py collectstatic --noinput

# 3.5 Custom Fix: Set Omar Farooq as Admin and Reset Passwords
echo "👑 Running Custom Security and Admin Fixes..."
$VENV_PYTHON manage.py shell <<'EOF'
from django.contrib.auth import get_user_model
from users.models import Profile
from schools.models import School
import unicodedata

User = get_user_model()

# 1. Omar Farooq Admin Fix
try:
    user = User.objects.get(email='faroqmsc1981@gmail.com')
    school = School.objects.get(id=16)
    profile, created = Profile.objects.get_or_create(user=user, defaults={'school': school, 'role': 'admin'})
    if not created:
        profile.role = 'admin'
        profile.school = school
        profile.save()
    user.is_staff = True
    user.save()
    print(f"Successfully set {user.username} as Admin for {school.name}")
except Exception as e:
    print(f"Error setting admin: {e}")
EOF

# Idempotent password reset: run only once by sentinel file
if [ -f "$BACKEND_DIR/.pw_reset_done" ]; then
  echo "🔒 Password reset already applied — skipping"
else
  echo "🔐 Resetting passwords for Students, Parents, and Committee members to 12345678..."
  $VENV_PYTHON manage.py shell <<'EOF'
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password

User = get_user_model()
target_roles = ['student', 'parent', 'committee']
updated_count = User.objects.filter(
    profile__role__in=target_roles,
    is_staff=False,
    is_superuser=False
).update(password=make_password('12345678'))
print(f"✅ Successfully reset passwords for {updated_count} users.")
EOF
  touch $BACKEND_DIR/.pw_reset_done
fi

# 4. Gunicorn and Socket Configuration (Robust Setup)
echo "⚙️ Configuring Gunicorn Service for Auto-Restart..."
cat <<EOF > /etc/systemd/system/gunicorn.socket
[Unit]
Description=gunicorn socket

[Socket]
ListenStream=/run/gunicorn.sock

[Install]
WantedBy=sockets.target
EOF

cat <<EOF > /etc/systemd/system/gunicorn.service
[Unit]
Description=gunicorn daemon
Requires=gunicorn.socket
After=network.target

[Service]
User=root
Group=www-data
WorkingDirectory=$BACKEND_DIR
ExecStart=$BACKEND_DIR/.venv/bin/gunicorn \\
          --access-logfile /var/log/gunicorn-access.log \\
          --error-logfile /var/log/gunicorn-error.log \\
          --workers 3 \\
          --timeout 120 \\
          --bind unix:/run/gunicorn.sock \\
          backend.wsgi:application
Restart=always
RestartSec=10
StandardOutput=append:/var/log/gunicorn-stdout.log
StandardError=append:/var/log/gunicorn-stderr.log

[Install]
WantedBy=multi-user.target
EOF

cat <<EOF > /etc/systemd/system/daphne.service
[Unit]
Description=daphne daemon
After=network.target

[Service]
User=root
Group=www-data
WorkingDirectory=$BACKEND_DIR
ExecStart=$BACKEND_DIR/.venv/bin/daphne \\
          -b 0.0.0.0 -p 8001 \\
          backend.asgi:application
Restart=always
RestartSec=10
StandardOutput=append:/var/log/daphne-stdout.log
StandardError=append:/var/log/daphne-stderr.log

[Install]
WantedBy=multi-user.target
EOF

# Ensure log files exist with correct permissions
touch /var/log/gunicorn-access.log /var/log/gunicorn-error.log /var/log/gunicorn-stdout.log /var/log/gunicorn-stderr.log
touch /var/log/daphne-stdout.log /var/log/daphne-stderr.log
chown www-data:www-data /var/log/gunicorn-*.log /var/log/daphne-*.log
chmod 664 /var/log/gunicorn-*.log /var/log/daphne-*.log

# 5. Service Restart and Health Check
echo "🔄 Restarting Services..."
systemctl daemon-reload
systemctl stop gunicorn gunicorn.socket daphne 2>/dev/null
systemctl start gunicorn.socket
systemctl enable gunicorn.socket
systemctl start gunicorn
systemctl enable gunicorn
systemctl start daphne
systemctl enable daphne

# Ensure socket permissions
if [ -S "/run/gunicorn.sock" ]; then
    echo "✅ Gunicorn socket found. Setting permissions..."
    chown root:www-data /run/gunicorn.sock
    chmod 660 /run/gunicorn.sock
else
    echo "❌ ERROR: Gunicorn socket NOT found at /run/gunicorn.sock"
    journalctl -u gunicorn --no-pager | tail -n 20
fi

# 6. Nginx Optimization for stability and UTF-8
echo "⚙️ Optimizing Nginx for stability and UTF-8..."
cat <<EOF > /etc/nginx/sites-available/bdapp.live
server {
    listen 80;
    server_name bdapp.live www.bdapp.live;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name bdapp.live www.bdapp.live;
    charset utf-8;
    client_max_body_size 100M;

    ssl_certificate /etc/letsencrypt/live/bdapp.live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bdapp.live/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location = /favicon.ico { access_log off; log_not_found off; }
    
    location /static/ {
        root /var/www/bdapp/frontend/build;
        try_files \$uri @django_static;
    }

    location @django_static {
        root $BACKEND_DIR/staticfiles;
        rewrite ^/static/(.*)$ /\$1 break;
    }

    location /media/ {
        alias /var/www/bdapp/media/;
        add_header Access-Control-Allow-Origin *;
        expires 30d;
        autoindex off;
        try_files $uri $uri/ @backend_media;
    }

    location @backend_media {
        alias $BACKEND_DIR/media/;
    }

    location /api/ {
        include proxy_params;
        proxy_pass http://unix:/run/gunicorn.sock;
        proxy_read_timeout 120s;
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
    }

    location /admin/ {
        include proxy_params;
        proxy_pass http://unix:/run/gunicorn.sock;
        proxy_read_timeout 120s;
        proxy_connect_timeout 120s;
    }

    location / {
        root /var/www/bdapp/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

nginx -t && systemctl restart nginx

# 7. Diagnostic Check
echo "🔍 Checking Backend Health..."
STATUS_CODE=$(curl -o /dev/null -s -w "%{http_code}\n" http://localhost:8000/api/v1/ 2>/dev/null || echo "FAIL")
if [ "$STATUS_CODE" == "200" ] || [ "$STATUS_CODE" == "301" ]; then
    echo "✅ Gunicorn is responding locally ($STATUS_CODE)"
else
    echo "⚠️ Gunicorn check failed (Status: $STATUS_CODE). Checking journalctl..."
    journalctl -u gunicorn --no-pager | tail -n 10
fi

# Check Daphne (ASGI)
if systemctl is-active --quiet daphne; then
    echo "✅ Daphne (ASGI) is active"
else
    echo "❌ Daphne (ASGI) is NOT active. Checking logs..."
    journalctl -u daphne --no-pager | tail -n 10
fi

# 8. Setup Auto-Fix Cron (Runs every minute to ensure service is alive)
echo "⏲️ Setting up Auto-Fix Cronjob..."
CRON_JOB="* * * * * (systemctl is-active --quiet gunicorn || systemctl restart gunicorn) && (systemctl is-active --quiet daphne || systemctl restart daphne) && (systemctl is-active --quiet nginx || systemctl restart nginx)"
(crontab -l 2>/dev/null | grep -v "gunicorn" ; echo "$CRON_JOB") | crontab -

echo "✅ Comprehensive Permanent Fixes Applied!"
