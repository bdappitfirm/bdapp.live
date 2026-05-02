# deploy_all.ps1
# This script will upload and deploy your project to the VPS
# Run this from your project root in PowerShell

param (
    [switch]$RestartOnly
)

$VPS_IP = "138.252.124.52"
$USER = "root"

if ($RestartOnly) {
    Write-Host ">>> Restarting Services on VPS (Gunicorn & Daphne)..." -ForegroundColor Yellow
    ssh -t "${USER}@${VPS_IP}" "systemctl daemon-reload && systemctl stop gunicorn gunicorn.socket daphne 2>/dev/null; systemctl start gunicorn.socket gunicorn daphne && echo '✅ Services Restarted Successfully!'"
    exit
}

Write-Host ">>> Packaging Backend Apps and Media..." -ForegroundColor Cyan
# Package all apps, necessary files, and MEDIA (if exists locally)
$includes = @("backend", "users", "schools", "academics", "attendance", "fees", "results", "manage.py", "requirements.txt", "scripts", "fix_all.sh")
if (Test-Path "media") {
    Write-Host "  → Found local media folder! Including it in package..." -ForegroundColor Yellow
    $includes += "media"
}
tar -cf backend_minimal.tar @includes

Write-Host ">>> Packaging Frontend..." -ForegroundColor Cyan
cd frontend
if (!(Test-Path "build")) {
    Write-Error "Build directory not found! Please run 'npm run build' in the frontend directory first."
    exit
}
tar -czf ../frontend.tar.gz build
cd ..

Write-Host ">>> Uploading files to VPS..." -ForegroundColor Cyan
scp backend_minimal.tar frontend.tar.gz fix_all.sh "${USER}@${VPS_IP}:/root/"

Write-Host ">>> Running deployment on VPS..." -ForegroundColor Cyan
# On the VPS, fix_all.sh will extract the files, migrate the DB, and restart gunicorn/daphne
ssh -t "${USER}@${VPS_IP}" "chmod +x /root/fix_all.sh && /root/fix_all.sh && rm -f /root/backend_minimal.tar /root/frontend.tar.gz"

Write-Host "`n✅ Deployment Complete! Check https://bdapp.live/" -ForegroundColor Green
Write-Host "💡 Pro-tip: Run '.\deploy_all.ps1 -RestartOnly' to quickly restart the server without redeploying." -ForegroundColor Gray
