# deploy_rsync.ps1 - Robust Deployment using PSCP.exe
$VPS_IP = "103.112.62.72"
$USER = "root"
$REMOTE_DIR = "/var/www/bdapp"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   FORCE DEPLOYING ALL RECENT UPDATES   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Build Frontend
Write-Host "Building Frontend (this ensures routine/menu updates)..." -ForegroundColor Yellow
Set-Location "frontend"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed!"
    Set-Location ..
    exit 1
}
Set-Location ..

# 2. Bundle Everything
Write-Host "Packing all project files..." -ForegroundColor Yellow
if (Test-Path "deploy.tar.gz") { Remove-Item "deploy.tar.gz" }
# Packing everything including your recent changes in results, academics etc.
tar -czf deploy.tar.gz backend users schools academics attendance fees results manage.py requirements.txt scripts fix_all.sh frontend/build

# 3. Upload using pscp.exe
Write-Host "Uploading update bundle to server..." -ForegroundColor Yellow
.\pscp.exe -v deploy.tar.gz "${USER}@${VPS_IP}:/tmp/deploy.tar.gz"

# 4. Force Extract and Run Fix on Server
Write-Host "Extracting and applying changes on server..." -ForegroundColor Cyan
# This one-liner extracts the NEW files first, then runs the NEW fix_all.sh
ssh "${USER}@${VPS_IP}" "tar -xzf /tmp/deploy.tar.gz -C $REMOTE_DIR/; chmod +x $REMOTE_DIR/fix_all.sh; $REMOTE_DIR/fix_all.sh"

# Cleanup
if (Test-Path "deploy.tar.gz") { Remove-Item "deploy.tar.gz" }

Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ ALL UPDATES (ROUTINE, MENU, GENDER) DEPLOYED! " -ForegroundColor Green
Write-Host "  Please HARD REFRESH (Ctrl+F5) your browser. " -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
