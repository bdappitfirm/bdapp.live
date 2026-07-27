# deploy_media.ps1 - Sync media files using tar + scp (No rsync needed)
$VPS_IP = "103.112.62.72"
$USER = "root"
$REMOTE_DIR = "/var/www/bdapp"
$LOCAL_MEDIA_DIR = "media"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   PACKAGING & SYNCING MEDIA FILES     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not (Test-Path $LOCAL_MEDIA_DIR)) {
    Write-Host "Local media directory not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Compressing media files (excluding school_ads)..." -ForegroundColor Yellow
if (Test-Path "media_sync.tar.gz") { Remove-Item "media_sync.tar.gz" -Force }

# Create a tarball of user photos and thumbnails
tar -czf media_sync.tar.gz --exclude="school_ads" media/user_photos media/user_thumbnails 2>$null

if (-not (Test-Path "media_sync.tar.gz")) {
    Write-Error "Failed to compress media files!"
    exit 1
}

Write-Host "Uploading to VPS..." -ForegroundColor Yellow
scp media_sync.tar.gz "${USER}@${VPS_IP}:/root/"

Write-Host "Extracting on VPS..." -ForegroundColor Yellow
$remoteCmd = "tar -xzf /root/media_sync.tar.gz -C $REMOTE_DIR/; " +
             "chown -R www-data:www-data $REMOTE_DIR/media; " +
             "chmod -R 775 $REMOTE_DIR/media; " +
             "rm /root/media_sync.tar.gz"

ssh "${USER}@${VPS_IP}" "$remoteCmd"

if (Test-Path "media_sync.tar.gz") { Remove-Item "media_sync.tar.gz" -Force }

Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ MEDIA SYNC COMPLETED SUCCESSFULLY! " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
