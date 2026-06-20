# deploy_rsync.ps1
# Rsync-based smart sync deployment for bdapp.live
# Only syncs changed files - 10x faster!
# Run this from your project root in PowerShell

param (
    [switch]$RestartOnly
)

$VPS_IP = "103.112.62.72"
$USER = "root"

if ($RestartOnly) {
    Write-Host ">>> Restarting Services on VPS (Gunicorn & Daphne)..." -ForegroundColor Yellow
    ssh -t "${USER}@${VPS_IP}" "systemctl daemon-reload && systemctl stop gunicorn gunicorn.socket daphne 2>/dev/null; systemctl start gunicorn.socket gunicorn daphne && echo '✅ Services Restarted Successfully!'"
    exit
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🚀 SMART RSYNC DEPLOYMENT STARTING" -ForegroundColor Cyan
Write-Host "  (Only changed files will be synced!)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n📦 Syncing Backend Files..." -ForegroundColor Yellow

$backendIncludes = @(
    "backend/",
    "users/",
    "schools/",
    "academics/",
    "attendance/",
    "fees/",
    "results/",
    "manage.py",
    "requirements.txt",
    "scripts/"
) -join " "

$backendExcludes = @(
    "--exclude=.git/",
    "--exclude=.venv/",
    "--exclude=__pycache__/",
    "--exclude=*.pyc",
    "--exclude=*.pyo",
    "--exclude=*.pyd",
    "--exclude=.DS_Store",
    "--exclude=media/",
    "--exclude=staticfiles/",
    "--exclude=*.tar",
    "--exclude=*.tar.gz",
    "--exclude=*.log"
) -join " "

$backendRsyncCmd = "rsync -avz --progress --delete $backendExcludes $backendIncludes ${USER}@${VPS_IP}:/var/www/bdapp/"
Write-Host "Running: $backendRsyncCmd"
Invoke-Expression $backendRsyncCmd

Write-Host "`n📦 Building Frontend..." -ForegroundColor Yellow

# Clean old build and rebuild
if (Test-Path "frontend/build") {
    Remove-Item -Path "frontend/build" -Recurse -Force
}
Set-Location "frontend"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed! Aborting deployment."
    Set-Location $PSScriptRoot
    exit 1
}
Set-Location $PSScriptRoot

Write-Host "`n📦 Syncing Frontend Files..." -ForegroundColor Yellow

$frontendRsyncCmd = "rsync -avz --progress --delete frontend/build/ ${USER}@${VPS_IP}:/var/www/bdapp/frontend/build/"
Write-Host "Running: $frontendRsyncCmd"
Invoke-Expression $frontendRsyncCmd

Write-Host "`n📦 Uploading VPS-side deployment script..." -ForegroundColor Yellow
scp deploy_rsync_vps.sh "${USER}@${VPS_IP}:/root/"

Write-Host "`n⚙️ Running deployment on VPS..." -ForegroundColor Cyan
ssh -t "${USER}@${VPS_IP}" "chmod +x /root/deploy_rsync_vps.sh && /root/deploy_rsync_vps.sh"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  ✅ DEPLOYMENT COMPLETE! " -ForegroundColor Green
Write-Host "  Check https://bdapp.live/" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Green
Write-Host "`n💡 Pro-tip: Run '.\deploy_rsync.ps1 -RestartOnly' to quickly restart the server without redeploying." -ForegroundColor Gray

