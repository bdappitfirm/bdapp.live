# sync_live_to_local.ps1
# Super Robust Sync Script for bdapp.live
# No complex dependencies required. Handles DB and Media separately.

$VPS_IP = "103.112.62.72"
$USER = "root"
$REMOTE_DB_NAME = "local_pg_db" 
$LOCAL_DB_NAME = "local_pg_db"  
$LOCAL_DB_USER = "local_pg_user"
$LOCAL_DB_PASSWORD = "Bangladesh@4321$" 

Write-Host "`n🔄 Initializing Secure Data Sync..." -ForegroundColor Cyan

# --- 1. Find PostgreSQL Path ---
$psql = "psql"
$commonPsqlPaths = @(
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe"
)
foreach ($p in $commonPsqlPaths) { if (Test-Path $p) { $psql = "`"$p`""; break } }

# --- 2. Database Sync (Using temporary file for Windows stability) ---
Write-Host "[1/2] Syncing Database Records (No password needed now)..." -ForegroundColor Yellow
$env:PGPASSWORD = $LOCAL_DB_PASSWORD

try {
    # Dump on server
    ssh "${USER}@${VPS_IP}" "sudo -u postgres pg_dump --clean --if-exists --no-owner --no-privileges $REMOTE_DB_NAME > /tmp/db_sync.sql"

    # Download to local
    scp "${USER}@${VPS_IP}:/tmp/db_sync.sql" ./db_sync.sql

    # Restore locally
    & cmd /c "$psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -f ./db_sync.sql" | Out-Null

    Write-Host "✅ Database Synced Successfully." -ForegroundColor Green
} catch {
    Write-Host "❌ Database sync failed! Check if PostgreSQL is running locally." -ForegroundColor Red
}

# --- 3. Media Sync (Student Photos, etc.) ---
Write-Host "`n[2/2] Syncing Media Files (Images)..." -ForegroundColor Yellow
if (!(Test-Path "media")) { New-Item -ItemType Directory -Path "media" | Out-Null }

Write-Host "🚀 Syncing images from VPS..." -ForegroundColor Gray
# Standard scp for broad compatibility
scp -r "${USER}@${VPS_IP}:/var/www/bdapp/media/*" ./media/

# --- 4. Cleanup ---
Write-Host "`n🧹 Cleaning up temporary files..." -ForegroundColor Gray
ssh "${USER}@${VPS_IP}" "rm /tmp/db_sync.sql"
if (Test-Path "./db_sync.sql") { Remove-Item "./db_sync.sql" -Force }

Write-Host "`n✨ SYNC COMPLETE!" -ForegroundColor Green
Write-Host "Your local project is now up-to-date with live data." -ForegroundColor Cyan
Write-Host "Happy coding!" -ForegroundColor White
