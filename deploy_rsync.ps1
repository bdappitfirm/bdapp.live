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

# 2. Bundle Everything with a timestamped filename to bypass all caches
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$zipName = "deploy_$timestamp.tar.gz"

Write-Host "Packing all project files into $zipName..." -ForegroundColor Yellow
tar -czf $zipName --exclude="media" --exclude="staticfiles" --exclude=".venv" --exclude="venv" --exclude="node_modules" --exclude="__pycache__" --exclude="*.pyc" --exclude="*.tar" --exclude="*.tar.gz" --exclude="*.zip" backend users schools academics attendance fees results manage.py requirements.txt scripts fix_all.sh fix_database_marks.py auto_translate.py fix_db_schema.py cleanup_orphaned_students.py school_19_students.json frontend/build

# 3. Upload using pscp.exe
Write-Host "Uploading update bundle to server..." -ForegroundColor Yellow
.\pscp.exe -v $zipName "${USER}@${VPS_IP}:/tmp/deploy_latest.tar.gz"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Upload failed! Please check your internet connection."
    if (Test-Path $zipName) { Remove-Item $zipName }
    exit 1
}

# 4. Force Extract and Run Fix on Server
Write-Host "Extracting and applying changes on server..." -ForegroundColor Cyan
# 1) Kill existing processes 2) Delete old build 3) Extract new 4) Run routine fix script
ssh "${USER}@${VPS_IP}" "rm -rf $REMOTE_DIR/frontend/build; tar -xzf /tmp/deploy_latest.tar.gz -C $REMOTE_DIR/; chmod +x $REMOTE_DIR/fix_all.sh; $REMOTE_DIR/fix_all.sh"

# Cleanup
if (Test-Path $zipName) { Remove-Item $zipName }

# Cleanup
if (Test-Path "deploy.tar.gz") { Remove-Item "deploy.tar.gz" }

Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ ALL UPDATES (ROUTINE, MENU, GENDER) DEPLOYED! " -ForegroundColor Green
Write-Host "  Please HARD REFRESH (Ctrl+F5) your browser. " -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
