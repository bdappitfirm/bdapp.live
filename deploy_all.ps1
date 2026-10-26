# deploy_all.ps1 - Automated Local to Live VPS Deployment Script for BDEDU
# Runs on Windows local machine.

$VPS_IP = "103.112.62.72"
$VPS_USER = "root"
$REMOTE_DIR = "/var/www/bdapp"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  BDEDU Automated Deployment Tool (Local -> Live)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Step 1: Build React Frontend
Write-Host "`n[1/5] Building React Frontend..." -ForegroundColor Yellow
Set-Location "frontend"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed!"
    Set-Location ".."
    exit 1
}
Set-Location ".."
Write-Host "Frontend build completed successfully." -ForegroundColor Green

# Step 2: Django Collect Static
Write-Host "`n[2/5] Collecting Django Static Files..." -ForegroundColor Yellow
python manage.py collectstatic --noinput
if ($LASTEXITCODE -ne 0) {
    Write-Warning "collectstatic encountered an issue, continuing..."
}
Write-Host "Static files collected." -ForegroundColor Green

# Step 3: Package Code & Assets into Tarball (including .env)
Write-Host "`n[3/5] Packaging deployment archive..." -ForegroundColor Yellow
$tarName = "deploy_latest.tar.gz"
if (Test-Path $tarName) { Remove-Item $tarName }

tar -czf $tarName --exclude="*.sqlite3" --exclude="__pycache__" --exclude=".git" --exclude="node_modules" --exclude="venv" --exclude=".venv" backend academics attendance fees results schools software_accounts users frontend/build staticfiles manage.py requirements.txt .env 2>&1

if (-not (Test-Path $tarName)) {
    Write-Error "Failed to create deployment tarball!"
    exit 1
}
Write-Host "Deployment archive created ($tarName)." -ForegroundColor Green

# Step 4: Upload to VPS
Write-Host "`n[4/5] Uploading deployment archive to VPS ($VPS_IP)..." -ForegroundColor Yellow
scp $tarName "${VPS_USER}@${VPS_IP}:/tmp/deploy_latest.tar.gz"
if ($LASTEXITCODE -ne 0) {
    Write-Error "SCP upload failed!"
    exit 1
}
Write-Host "Upload completed successfully." -ForegroundColor Green

# Step 5: Extract, Sync DB Password, Migrate, and Restart Services on VPS
Write-Host "`n[5/5] Deploying and restarting services on VPS..." -ForegroundColor Yellow

$remoteScript = @'
set -e
echo 'Extracting deployment package...'
mkdir -p /var/www/bdapp
tar -xzf /tmp/deploy_latest.tar.gz -C /var/www/bdapp/

echo 'Syncing PostgreSQL user password with .env...'
cd /var/www/bdapp
if [ -f .env ]; then
    PG_PASS=$(grep '^PG_PASSWORD=' .env | cut -d '=' -f 2 | tr -d '\r')
    if [ ! -z "$PG_PASS" ]; then
        sudo -u postgres psql -c "ALTER USER local_pg_user WITH PASSWORD '$PG_PASS';" || true
    fi
fi

echo 'Running database migrations & collectstatic...'
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
fi
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo 'Setting permissions...'
chown -R www-data:www-data /var/www/bdapp || true
chmod -R 755 /var/www/bdapp || true

echo 'Restarting Gunicorn, Daphne, and Nginx...'
systemctl restart gunicorn daphne nginx || systemctl restart gunicorn nginx
echo 'DEPLOYMENT SUCCESSFUL!'
'@

# Clean CRLF and pipe script directly into ssh via stdin (100% robust against quoting/syntax issues)
$cleanedScript = $remoteScript -replace "`r", ""
$cleanedScript | ssh -t "${VPS_USER}@${VPS_IP}" "bash"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Remote VPS deployment command failed!"
    exit 1
}

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETED SUCCESSFULLY TO LIVE VPS!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
