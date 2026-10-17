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
    Write-Host "Cleaning old build and build cache..." -ForegroundColor Yellow
    if (Test-Path "$PROJECT_ROOT\frontend\build") {
        Remove-Item -Path "$PROJECT_ROOT\frontend\build" -Recurse -Force
    }
    # Clear webpack cache to prevent incremental build issues
    if (Test-Path "$PROJECT_ROOT\frontend\node_modules\.cache") {
        Remove-Item -Path "$PROJECT_ROOT\frontend\node_modules\.cache" -Recurse -Force
    }
    
    Write-Host "Building Frontend..." -ForegroundColor Yellow
    Set-Location "$PROJECT_ROOT\frontend"
    $env:NODE_OPTIONS = "--max-old-space-size=4096"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Frontend build failed! Aborting deployment."
        Set-Location $PROJECT_ROOT
        exit 1
    }
    Set-Location $PROJECT_ROOT

    # Verify build timestamp
    $mainJs = Get-ChildItem -Path "$PROJECT_ROOT\frontend\build\static\js\main.*.js" | Select-Object -First 1
    if ($mainJs) {
        Write-Host "Build successful! New main.js: $($mainJs.Name) (Modified: $($mainJs.LastWriteTime))" -ForegroundColor Green
    }

    Write-Host "Syncing build/index.html -> templates/index.html ..." -ForegroundColor Yellow
    $srcIdx = "$PROJECT_ROOT\frontend\build\index.html"
    $dstIdx = "$PROJECT_ROOT\templates\index.html"
    if (Test-Path $srcIdx) {
        Copy-Item -Path $srcIdx -Destination $dstIdx -Force
        Write-Host "  - Copied build\index.html -> templates\index.html" -ForegroundColor Gray
    } else {
        Write-Warning "  - WARNING: build\index.html not found!"
    }

    Write-Host "Syncing frontend\build\static\* -> static\ (for collectstatic) ..." -ForegroundColor Yellow
    $srcBuildStatic = "$PROJECT_ROOT\frontend\build\static"
    $dstStaticRoot = "$PROJECT_ROOT\static"
    if (Test-Path $srcBuildStatic) {
        if (Test-Path $dstStaticRoot) {
            Remove-Item -Path "$dstStaticRoot\*" -Recurse -Force -ErrorAction SilentlyContinue
        }
        New-Item -ItemType Directory -Path $dstStaticRoot -Force | Out-Null
        Copy-Item -Path "$srcBuildStatic\*" -Destination $dstStaticRoot -Recurse -Force
        Write-Host "  - Synced frontend\build\static\ -> static\" -ForegroundColor Gray
    } else {
        Write-Warning "  - WARNING: frontend\build\static\ not found!"
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
        "software_accounts",
        "manage.py",
        "requirements.txt",
        "scripts",
        "fix_all.sh",
        "fix_database_marks.py",
        "fix_optional_subjects.py",
        "auto_translate.py",
        "fix_practical_marks.py",
        "recalculate_all_merit_lists.py",
        "merge_subject_exams.py",
        "fix_db_schema.py",
        "cleanup_students.py",
        "cleanup_orphaned_students.py",
        "restore_db.sh",
        "nginx_setup.sh",
        "gunicorn_setup.sh",
        "deploy_rsync_vps.sh",
        "static",
        "templates"
    )
    if (Test-Path "backend_minimal.tar") { Remove-Item "backend_minimal.tar" -Force }
    tar -cf backend_minimal.tar --exclude="media" --exclude="staticfiles" --exclude=".venv" --exclude="venv" --exclude="node_modules" --exclude="__pycache__" --exclude="*.pyc" --exclude="*.tar" --exclude="*.tar.gz" --exclude="*.zip" @includes
}

Write-Host "Uploading Files to VPS..." -ForegroundColor Cyan
$uploadFiles = @()
if (Test-Path "backend_minimal.tar") { $uploadFiles += "backend_minimal.tar" }
if (Test-Path "frontend.tar.gz") { $uploadFiles += "frontend.tar.gz" }
$uploadFiles += "fix_all.sh"
$uploadFiles += "nginx_setup.sh"

$maxRetries = 3
$retryCount = 0
$success = $false

while (-not $success -and $retryCount -lt $maxRetries) {
    if ($retryCount -gt 0) {
        Write-Host "Retrying upload (Attempt $($retryCount + 1) of $maxRetries)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
    scp @uploadFiles "${USER}@${VPS_IP}:/root/"
    if ($LASTEXITCODE -eq 0) {
        $success = $true
    } else {
        $retryCount++
    }
}
if (-not $success) {
    Write-Error "Upload failed after $maxRetries attempts! Aborting deployment. Please check your internet connection and try again."
    exit 1
}

Write-Host "Running Deployment on VPS (Extraction + nginx config + migrations)..." -ForegroundColor Cyan

$extractFrontend = ""
if (-not $NoFrontend) {
    $extractFrontend = "rm -rf /var/www/bdapp/frontend/build; " +
                       "mkdir -p /var/www/bdapp/frontend/build; " +
                       "tar -xzf frontend.tar.gz -C /var/www/bdapp/frontend/build --strip-components=1; "
}

$remoteCmd = "set -e; cd /root; " +
             "tar -xf backend_minimal.tar -C /var/www/bdapp/; " +
             $extractFrontend +
             "cp fix_all.sh /var/www/bdapp/fix_all.sh; " +
             "chmod +x /var/www/bdapp/fix_all.sh; " +
             "if [ -f nginx_setup.sh ]; then cp nginx_setup.sh /var/www/bdapp/nginx_setup.sh; chmod +x /var/www/bdapp/nginx_setup.sh; bash /var/www/bdapp/nginx_setup.sh; fi; " +
             "bash /var/www/bdapp/fix_all.sh; " +
             "rm -f /root/backend_minimal.tar /root/frontend.tar.gz /root/fix_all.sh /root/nginx_setup.sh 2>/dev/null"

ssh -t "${USER}@${VPS_IP}" "$remoteCmd"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
    Write-Host "  DEPLOYMENT FAILED ON VPS!" -ForegroundColor Red
    Write-Host "  Check the error messages above." -ForegroundColor Red
    Write-Host "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!" -ForegroundColor Red
    exit 1
}

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
