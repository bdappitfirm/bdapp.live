#!/bin/bash
# fix_all.sh - Comprehensive deployment and fix script for bdapp.live
echo "ðŸš€ Starting Master Deployment Fix for bdapp.live..."

# 0. Install required build dependencies
echo "ðŸ“¦ Installing build dependencies..."
apt update
apt install -y build-essential pkg-config libpq-dev

# 1. Extraction (if new tars exist)
BACKEND_DIR="/var/www/bdapp"
FRONTEND_DIR="/var/www/bdapp/frontend/build"

if [ -f "/root/backend_minimal.tar" ]; then
    echo "ðŸ“¦ Extracting Backend..."
    mkdir -p $BACKEND_DIR
    # Extract into PROJECT ROOT instead of directly backend folder
    mkdir -p /var/www/bdapp
    tar -xf /root/backend_minimal.tar -C /var/www/bdapp/
    
    # --- COPY LOCAL MEDIA from tar to server locations!
    if [ -d "/var/www/bdapp/media" ]; then
        echo "âœ… Found LOCAL MEDIA from tar! Copying to all media locations..."
        cp -ar /var/www/bdapp/media/. $BACKEND_DIR/media/ 2>/dev/null || true
    fi
fi

# --- ULTIMATE MEDIA FIX ---
echo "ðŸ“¸ STARTING ULTIMATE MEDIA RESCUE!"

# List all possible media locations first
echo "ðŸ” SEARCHING FOR ALL MEDIA FILES..."
for CHECK in "/var/www/bdapp/media" "/var/www/bdapp/backend/media" "/root/media"
do
    if [ -d "$CHECK" ]; then
        echo "âœ… Found media at $CHECK"
        echo "   Contents (first 20 files):"
        ls -la "$CHECK" 2>/dev/null | head -30
    fi
done

# 1. Ensure both media locations exist
mkdir -p /var/www/bdapp/media
mkdir -p $BACKEND_DIR/media

# 2. Copy everything from EVERY possible source
echo "ðŸšš COPYING ALL MEDIA FILES..."
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
echo "ðŸ”‘ SETTING FULL MEDIA PERMISSIONS..."
chown -R www-data:www-data /var/www/bdapp/media
chown -R www-data:www-data $BACKEND_DIR/media
chmod -R 777 /var/www/bdapp/media
chmod -R 777 $BACKEND_DIR/media

# 5. Show final media structure
echo "âœ… FINAL MEDIA CHECK:"
ls -la /var/www/bdapp/media/ 2>/dev/null || true

mkdir -p $BACKEND_DIR/staticfiles
mkdir -p $BACKEND_DIR/static

if [ -f "/root/frontend.tar.gz" ]; then
    echo "ðŸ“¦ Extracting Frontend..."
    mkdir -p $FRONTEND_DIR
    tar -xzf /root/frontend.tar.gz -C /var/www/bdapp/frontend/
    # If nested build/ exists, move it
    if [ -d "$FRONTEND_DIR/build" ]; then
        cp -r $FRONTEND_DIR/build/* $FRONTEND_DIR/
        rm -rf $FRONTEND_DIR/build
    fi
fi

# 2. Permissions (Fixed for Executables)
echo "ðŸ”‘ Setting permissions for www-data..."
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
echo "âš™ï¸ Running Backend Setup..."
cd $BACKEND_DIR

# Ensure .env exists with production settings
if [ -f "$BACKEND_DIR/backend/.env" ]; then
    echo "ðŸšš Moving existing .env from backend/ to root..."
    mv "$BACKEND_DIR/backend/.env" "$BACKEND_DIR/.env"
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "ðŸ“ Creating default .env file..."
    cat <<EOF > $BACKEND_DIR/.env
DEBUG=False
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')
PG_NAME=local_pg_db
PG_USER=local_pg_user
PG_PASSWORD=Bangladesh@4321$
PG_HOST=localhost
PG_PORT=5432
USE_POSTGRES=True
ALLOWED_HOSTS=bdapp.live,www.bdapp.live,api.bdapp.live,103.112.62.72,127.0.0.1,localhost
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

# DEEP CLEAN: Recreate venv to fix issues
echo "ðŸ§¹ Performing DEEP CLEAN of Virtualenv and Cache..."
rm -rf .venv
rm -rf ~/.cache/pip
rm -f $BACKEND_DIR/.deep_clean_v9
touch $BACKEND_DIR/.deep_clean_v10

if [ ! -d ".venv" ]; then
    echo "ðŸ“¦ Virtualenv not found. Creating one..."
    python3 -m venv .venv
fi

VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"
VENV_PIP="$BACKEND_DIR/.venv/bin/pip"

# ðŸ“¦ Master Dependency Sync
echo "ðŸ“¦ Syncing dependencies..."
$VENV_PIP install -r requirements.txt
$VENV_PIP install gunicorn daphne

# Verify Gunicorn and Daphne are installed
echo "âœ… Verifying Gunicorn and Daphne installation..."
if [ -f "$BACKEND_DIR/.venv/bin/gunicorn" ]; then
    echo "âœ… Gunicorn found at $BACKEND_DIR/.venv/bin/gunicorn"
    chmod +x "$BACKEND_DIR/.venv/bin/gunicorn"
else
    echo "âŒ ERROR: Gunicorn not found!"
fi

if [ -f "$BACKEND_DIR/.venv/bin/daphne" ]; then
    echo "âœ… Daphne found at $BACKEND_DIR/.venv/bin/daphne"
    chmod +x "$BACKEND_DIR/.venv/bin/daphne"
else
    echo "âŒ ERROR: Daphne not found!"
fi

echo "ðŸ” Checking Database Connection and Tables..."
$VENV_PYTHON manage.py shell <<'EOF'
from django.db import connection
try:
    connection.ensure_connection()
    tables = connection.introspection.table_names()
    print(f"âœ… Database connection successful. Found {len(tables)} tables.")
    if 'schools_school' in tables:
        print("âœ… 'schools_school' table exists.")
    else:
        print("âš ï¸ 'schools_school' table is MISSING!")
except Exception as e:
    print(f"âŒ Database connection failed: {e}")
EOF

echo "ðŸš€ Running Migrations..."
# Fix ownership issues in PostgreSQL more aggressively using psql directly as postgres user
echo "ðŸ”‘ Fixing Database Ownership for all objects..."
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

# ðŸ› ï¸ Database Fixes (Before Migration)
echo "ðŸ› ï¸ Applying pre-migration database fixes..."
sudo -u postgres psql -d local_pg_db -c "UPDATE schools_advertisement SET school_id = (SELECT id FROM schools_school LIMIT 1) WHERE school_id IS NULL;" 2>/dev/null || true

# ðŸ—„ï¸ Database Migrations
echo "ðŸ—„ï¸ Running migrations..."
$VENV_PYTHON manage.py makemigrations schools
$VENV_PYTHON manage.py migrate --noinput

echo "ðŸ“‚ Collecting Static Files..."
$VENV_PYTHON manage.py collectstatic --noinput

# 3.5 Custom Fix: Set Omar Farooq as Admin and Reset Passwords
echo "ðŸ‘‘ Running Custom Security and Admin Fixes..."
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

# ðŸ—„ï¸ Restore Old Database Backup
echo "ðŸ—„ï¸ Checking for database backup..."
if [ -f "$BACKEND_DIR/local_db_backup.sql" ]; then
    echo "ðŸ“¦ Found database backup (SQL format)! Restoring your old data..."
    
    # Stop services temporarily
    systemctl stop gunicorn gunicorn.socket daphne 2>/dev/null
    
    # First, try to restore the SQL file directly (it may contain CREATE DATABASE)
    sudo -u postgres psql < "$BACKEND_DIR/local_db_backup.sql" 2>/tmp/restore_errors.txt || true
    
    # Check if restore was successful by checking for users_user table
    TABLE_EXISTS=$(sudo -u postgres psql -d local_pg_db -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users_user');" 2>/dev/null || echo "f")
    
    if echo "$TABLE_EXISTS" | grep -q "t\|true"; then
        echo "âœ… Database restored successfully from SQL file!"
    else
        echo "âš ï¸ Direct restore failed. Trying alternative method..."
        # Drop and recreate database, then restore without the CREATE DATABASE commands
        sudo -u postgres psql <<EOF
DROP DATABASE IF EXISTS local_pg_db;
CREATE DATABASE local_pg_db OWNER local_pg_user;
EOF
        # Restore only the data part
        sudo -u postgres psql -d local_pg_db -f "$BACKEND_DIR/local_db_backup.sql" 2>/dev/null || true
    fi
    
    # Fix ownership
    sudo -u postgres psql -d local_pg_db 2>/dev/null <<EOF
REASSIGN OWNED BY postgres TO local_pg_user;
ALTER SCHEMA public OWNER TO local_pg_user;
EOF
    
    echo "âœ… Old database restored successfully!"
    
    # Clean up the backup file
    rm -f "$BACKEND_DIR/local_db_backup.sql"
else
    echo "âš ï¸ No database backup found. Seeding demo data instead..."
    SCHOOL_COUNT=$($VENV_PYTHON manage.py shell -c "from schools.models import School; print(School.objects.count())" 2>/dev/null || echo "0")
    if [ "$SCHOOL_COUNT" -eq "0" ]; then
        $VENV_PYTHON manage.py seed_demo_data --create-school --school-name "à¦­à¦¾à¦°à¦¤à§€ à¦¬à¦¿à¦¦à§à¦¯à¦¾à¦¨à¦¿à¦•à§‡à¦¤à¦¨" --students 50 --teachers 10
        $VENV_PYTHON manage.py seed_demo_data --create-school --school-name "à¦†à¦¦à¦°à§à¦¶ à¦‰à¦šà§à¦š à¦¬à¦¿à¦¦à§à¦¯à¦¾à¦²à¦¯à¦¼" --students 40 --teachers 8
        $VENV_PYTHON manage.py seed_demo_data --create-school --school-name "à¦¶à¦¿à¦¶à§ à¦¶à¦¿à¦•à§à¦·à¦¾ à¦¨à¦¿à¦•à§‡à¦¤à¦¨" --students 30 --teachers 6
        echo "âœ… Demo data seeded successfully!"
    else
        echo "âœ… $SCHOOL_COUNT schools already exist."
    fi
fi

# Now reset passwords AFTER database is fully restored
echo "ðŸ” Resetting passwords for Students, Parents, and Committee members to 12345678..."
$VENV_PYTHON manage.py shell <<'EOF'
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password

User = get_user_model()
try:
    target_roles = ['student', 'parent', 'committee']
    updated_count = User.objects.filter(
        profile__role__in=target_roles,
        is_staff=False,
        is_superuser=False
    ).update(password=make_password('12345678'))
    print(f"âœ… Successfully reset passwords for {updated_count} users.")
except Exception as e:
    print(f"âš ï¸ Password reset skipped: {e}")
EOF

# 4. Gunicorn and Socket Configuration (Robust Setup)
echo "âš™ï¸ Configuring Gunicorn Service for Auto-Restart..."
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
echo "ðŸ”„ Restarting Services..."
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
    echo "âœ… Gunicorn socket found. Setting permissions..."
    chown root:www-data /run/gunicorn.sock
    chmod 660 /run/gunicorn.sock
else
    echo "âŒ ERROR: Gunicorn socket NOT found at /run/gunicorn.sock"
    journalctl -u gunicorn --no-pager | tail -n 20
fi

# 6. Nginx Optimization for stability and UTF-8 (with HTTPS support)
echo "âš™ï¸ Optimizing Nginx for stability and UTF-8..."
# Clean up old configs
rm -f /etc/nginx/sites-enabled/*
rm -f /etc/nginx/sites-available/*

cat <<EOF > /etc/nginx/sites-available/bdapp.live
server {
    listen 80;
    server_name bdapp.live www.bdapp.live 103.112.62.72;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bdapp.live www.bdapp.live 103.112.62.72;
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

# Enable the Nginx site
ln -sf /etc/nginx/sites-available/bdapp.live /etc/nginx/sites-enabled/

# Test Nginx config and restart
nginx -t && systemctl restart nginx

# 7. Diagnostic Check
echo "ðŸ” Checking Backend Health..."
sleep 5

# Check if Gunicorn is active
if systemctl is-active --quiet gunicorn; then
    echo "âœ… Gunicorn is active!"
else
    echo "âŒ ERROR: Gunicorn is NOT active!"
    systemctl status gunicorn --no-pager
fi

# Check if Daphne is active
if systemctl is-active --quiet daphne; then
    echo "âœ… Daphne is active!"
else
    echo "âŒ ERROR: Daphne is NOT active!"
    systemctl status daphne --no-pager
fi

echo "ðŸš€ Master Deployment Fix Complete!"
