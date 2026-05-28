# deploy_all.ps1 - One-click complete deployment for bdapp.live
# This script will handle everything from packaging to deployment
# Defaults to smart rsync deployment, but supports full tarball as fallback
# Run this from your project root in PowerShell

param (
    [switch]$RestartOnly,
    [switch]$NoFrontend,
    [switch]$NoBackend,
    [switch]$UseTarball
)

$VPS_IP = "103.112.62.72"
$USER = "root"
$PROJECT_ROOT = $PWD.Path

if ($RestartOnly) {
    Write-Host ">>> Restarting Services on VPS (Gunicorn & Daphne)..." -ForegroundColor Yellow
    ssh -t "${USER}@${VPS_IP}" "systemctl daemon-reload && systemctl stop gunicorn gunicorn.socket daphne 2>/dev/null; systemctl start gunicorn.socket gunicorn daphne && echo 'Services Restarted Successfully!'"
    exit
}

# Check if rsync is available
$rsyncAvailable = $false
try {
    $rsyncPath = Get-Command rsync -ErrorAction Stop
    $rsyncAvailable = $true
} catch {
    $commonRsyncPaths = @(
        "C:\Program Files\Git\usr\bin\rsync.exe",
        "C:\Program Files\Git\bin\rsync.exe",
        "$env:LOCALAPPDATA\Programs\Git\usr\bin\rsync.exe"
    )
    foreach ($path in $commonRsyncPaths) {
        if (Test-Path $path) {
            $env:Path += ";$(Split-Path $path)"
            $rsyncAvailable = $true
            break
        }
    }
}

if (-not $UseTarball -and $rsyncAvailable) {
    Write-Host "Smart rsync deployment available - using differential sync (faster!)" -ForegroundColor Green
    Write-Host "Use -UseTarball if you want full tarball deployment instead" -ForegroundColor Gray
    $argsList = @()
    if ($RestartOnly) { $argsList += "-RestartOnly" }
    & .\deploy_rsync.ps1 @argsList
    exit
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FULL DEPLOYMENT STARTING (TARBALL MODE)" -ForegroundColor Cyan
Write-Host "  bdapp.live - 103.112.62.72" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan

if (-not $NoFrontend) {
    Write-Host "Checking Frontend Build..." -ForegroundColor Yellow
    if (!(Test-Path "$PROJECT_ROOT\frontend\build")) {
        Write-Host "Frontend build not found! Building now..." -ForegroundColor Yellow
        Set-Location "$PROJECT_ROOT\frontend"
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Frontend build failed! Aborting deployment."
            exit 1
        }
        Set-Location $PROJECT_ROOT
    }
    Write-Host "Packaging Frontend..." -ForegroundColor Cyan
    if (Test-Path "frontend.tar.gz") { Remove-Item "frontend.tar.gz" -Force }
    tar -czf frontend.tar.gz -C frontend build
}

if (-not $NoBackend) {
    Write-Host "Packaging Backend..." -ForegroundColor Yellow
    $includes = @(
        "backend",
        "users",
        "schools",
        "academics",
        "attendance",
        "fees",
        "results",
        "manage.py",
        "requirements.txt",
        "scripts",
        "fix_all.sh",
        "restore_db.sh",
        "nginx_setup.sh",
        "gunicorn_setup.sh",
        "deploy_rsync_vps.sh"
    )
    if (Test-Path "media") {
        Write-Host "Including media folder..." -ForegroundColor Yellow
        $includes += "media"
    }
    if (Test-Path "static") {
        Write-Host "Including static folder..." -ForegroundColor Yellow
        $includes += "static"
    }
    if (Test-Path "backend_minimal.tar") { Remove-Item "backend_minimal.tar" -Force }
    tar -cf backend_minimal.tar @includes
}

Write-Host "Uploading Files to VPS..." -ForegroundColor Cyan
$uploadFiles = @()
if (Test-Path "backend_minimal.tar") { $uploadFiles += "backend_minimal.tar" }
if (Test-Path "frontend.tar.gz") { $uploadFiles += "frontend.tar.gz" }
$uploadFiles += "fix_all.sh"
scp @uploadFiles "${USER}@${VPS_IP}:/root/"

Write-Host "Running Deployment on VPS..." -ForegroundColor Cyan
ssh -t "${USER}@${VPS_IP}" "cd /root; chmod +x fix_all.sh; ./fix_all.sh; rm -f /root/backend_minimal.tar /root/frontend.tar.gz /root/fix_all.sh; echo 'Deployment Complete!'"

Write-Host "Cleaning up local temporary files..." -ForegroundColor Gray
if (Test-Path "backend_minimal.tar") { Remove-Item "backend_minimal.tar" -Force }
if (Test-Path "frontend.tar.gz") { Remove-Item "frontend.tar.gz" -Force }

Write-Host "========================================" -ForegroundColor Green
Write-Host "  FULL DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "  Check https://bdapp.live/" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
Write-Host "Quick Commands:" -ForegroundColor Gray
Write-Host "  - Restart only: .\deploy_all.ps1 -RestartOnly" -ForegroundColor Gray
Write-Host "  - Skip frontend: .\deploy_all.ps1 -NoFrontend" -ForegroundColor Gray
Write-Host "  - Skip backend: .\deploy_all.ps1 -NoBackend" -ForegroundColor Gray
Write-Host "  - Use tarball mode: .\deploy_all.ps1 -UseTarball" -ForegroundColor Gray
