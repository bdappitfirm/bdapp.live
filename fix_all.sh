#!/bin/bash
# ====================================================================
#  fix_all.sh  -  LIVE SERVER ONLY: Code Deployment + Migration Runner
# ====================================================================
#
#  PURPOSE (runs ONLY on the LIVE VPS):
#    1. Applies NEW Django migrations (--noinput) to LIVE schema.
#    2. Collects static files (updated React frontend build).
#    3. Fixes owner/permissions on application files.
#    4. Runs data-quality helpers (name transliteration, CA subject fixes).
#    5. Restarts gunicorn/daphne services.
#
#  CRITICAL SEPARATION OF WORKFLOWS:
#    ---------------------------------------------------------------
#    THIS SCRIPT            = CODE + MIGRATIONS  (LOCAL -> LIVE)
#    sync_live_to_local.ps1 = DATA ONLY           (LIVE -> LOCAL)
#    ---------------------------------------------------------------
#
#  FORBIDDEN HERE (by design):
#    - NO pull/rsync of code FROM live TO local
#    - NO database DROP / TRUNCATE / pg_restore of the WHOLE database
#    - NO destructive overwrite of user/admin-entered data
#    - NO replacement of django_migrations rows
#    - NO copy of the live DB schema back to developers
# ====================================================================
set -e

BACKEND_DIR="/var/www/bdapp"
VENV_PYTHON="$BACKEND_DIR/.venv/bin/python3"

echo "========================================"
echo " LIVE-ONLY: Code/Migration Post-Deploy"
echo " (no destructive database operations)"
echo "========================================"

cd "$BACKEND_DIR"

# 1) Apply NEW Django migrations only (existing tables/data untouched)
echo "[1/7] Running Django migrations (--noinput, no data loss)..."
# Safety: never use --fake-initial here; only regular migrate.
"$VENV_PYTHON" manage.py migrate --noinput || {
    # Very specific workaround for historical academics 0010 constraint
    # conflict already present on some older installations.
    echo "Migration reported conflict; attempting targeted fake of 0010 only."
    "$VENV_PYTHON" manage.py migrate academics 0010 --fake --noinput 2>/dev/null || true
    "$VENV_PYTHON" manage.py migrate --noinput
}

# 2) Clear STATIC_ROOT FIRST to force full refresh (avoids stale hashed JS/CSS)
echo "[2/7] Wiping staticfiles/ for clean collectstatic ..."
if [ -d "$BACKEND_DIR/staticfiles" ]; then
    rm -rf "$BACKEND_DIR/staticfiles" 2>/dev/null || true
fi
mkdir -p "$BACKEND_DIR/staticfiles"

# Extra: Wipe Django system cache to clear template caching
echo "[2b/7] Clearing Django cache..."
"$VENV_PYTHON" manage.py shell -c "from django.core.cache import cache; cache.clear()" 2>/dev/null || true

# 3) Collect static (React frontend build files) - with --clear + --noinput
echo "[3/7] Collecting static files (full refresh)..."
"$VENV_PYTHON" manage.py collectstatic --clear --noinput

# 4) Permissions
echo "[4/7] Ensuring correct ownership/permissions..."
chown -R www-data:www-data "$BACKEND_DIR"
chmod +x "$BACKEND_DIR/.venv/bin/"* 2>/dev/null || true

# 5) Data-quality helpers (DISABLED as per user request to avoid overwriting manual updates)
# echo "[5/7] Transliterating Bangla names -> English (only empty EN fields)..."
# "$VENV_PYTHON" auto_translate.py --force 2>/dev/null || true

# echo "[6/7] Fixing CA subject pass status (Book Reading, PE, etc.)..."
# "$VENV_PYTHON" fix_ca_subjects.py 2>/dev/null || true

# 6) Restart application servers
echo "[5/7] Restarting gunicorn + daphne..."
systemctl daemon-reload 2>/dev/null || true
systemctl restart gunicorn daphne 2>/dev/null || systemctl restart gunicorn.service daphne.service 2>/dev/null || true

# 7) Reload nginx (in case new static files need picking up)
echo "[6/7] Reloading nginx..."
nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || echo "nginx reload skipped"

echo "========================================"
echo " fix_all.sh complete."
echo " NOTE: LIVE DATA never leaves this server."
echo " For local dev data, run sync_live_to_local.ps1 on your Windows PC."
echo " After deploy, do browser Ctrl+Shift+R (hard reload) to bypass service worker cache."
echo "========================================"
