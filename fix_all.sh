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
echo "[1/6] Running Django migrations (--noinput, no data loss)..."
# Safety: never use --fake-initial here; only regular migrate.
"$VENV_PYTHON" manage.py migrate --noinput || {
    # Very specific workaround for historical academics 0010 constraint
    # conflict already present on some older installations.
    echo "Migration reported conflict; attempting targeted fake of 0010 only."
    "$VENV_PYTHON" manage.py migrate academics 0010 --fake --noinput 2>/dev/null || true
    "$VENV_PYTHON" manage.py migrate --noinput
}

# 2) Collect static (React frontend build files)
echo "[2/6] Collecting static files..."
"$VENV_PYTHON" manage.py collectstatic --noinput

# 3) Permissions
echo "[3/6] Ensuring correct ownership/permissions..."
chown -R www-data:www-data "$BACKEND_DIR"
chmod +x "$BACKEND_DIR/.venv/bin/"* 2>/dev/null || true

# 4) Data-quality helpers (DISABLED as per user request to avoid overwriting manual updates)
# echo "[4/6] Transliterating Bangla names -> English (only empty EN fields)..."
# "$VENV_PYTHON" auto_translate.py --force 2>/dev/null || true

# echo "[5/6] Fixing CA subject pass status (Book Reading, PE, etc.)..."
# "$VENV_PYTHON" fix_ca_subjects.py 2>/dev/null || true

# 6) Restart application servers
echo "[4/6] Restarting gunicorn + daphne..."
systemctl restart gunicorn daphne

echo "========================================"
echo " fix_all.sh complete."
echo " NOTE: LIVE DATA never leaves this server."
echo " For local dev data, run sync_live_to_local.ps1 on your Windows PC."
echo "========================================"
