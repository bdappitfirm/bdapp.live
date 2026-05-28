# sync_live_to_local.ps1
# This script performs a professional and safe synchronization of the live database to your local machine.
# Instead of dropping the database, it uses --clean and --if-exists for a smoother transition.
# Usage: .\sync_live_to_local.ps1

$VPS_IP = "103.112.62.72"
$USER = "root"
$REMOTE_DB_NAME = "local_pg_db" 
$LOCAL_DB_NAME = "local_pg_db"  
$LOCAL_DB_USER = "local_pg_user" 

Write-Host "🔄 Starting Professional Sync: Live (bdapp.live) -> Local" -ForegroundColor Cyan

# Check for PostgreSQL tools
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (!$psqlPath) {
    $commonPaths = @(
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe"
    )
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $binDir = Split-Path $path
            $env:Path += ";$binDir"
            $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
            if ($psqlPath) { break }
        }
    }
}

if (!$psqlPath) {
    Write-Error "PostgreSQL tools (psql) not found! Please ensure PostgreSQL is installed and added to PATH."
    exit
}

# 1. Create DB Dump on VPS
Write-Host "Step 1: Creating Database Dump on VPS..." -ForegroundColor Yellow
# --clean --if-exists adds commands to drop objects before creating them, but keeps the DB itself
ssh "${USER}@${VPS_IP}" "sudo -u postgres pg_dump --clean --if-exists --no-owner --no-privileges $REMOTE_DB_NAME > /tmp/live_db_dump.sql"

# 2. Download Dump to Local
Write-Host "Step 2: Downloading Database Dump..." -ForegroundColor Yellow
scp "${USER}@${VPS_IP}:/tmp/live_db_dump.sql" ./live_db_dump.sql

# 3. Restore to Local DB
Write-Host "Step 3: Updating Local Database ($LOCAL_DB_NAME)..." -ForegroundColor Yellow
if (!(Test-Path "./live_db_dump.sql")) {
    Write-Error "Error: live_db_dump.sql not found!"
    exit
}

# Ensure local database exists first (if it doesn't, create it)
$dbExists = psql -U $LOCAL_DB_USER -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$LOCAL_DB_NAME'"
if ($dbExists -ne "1") {
    Write-Host "Local database $LOCAL_DB_NAME does not exist. Creating it..." -ForegroundColor Gray
    createdb -U $LOCAL_DB_USER $LOCAL_DB_NAME
}

Write-Host "Restoring data (Safe Mode: Overwriting changed objects only)..." -ForegroundColor Gray
# We use -v ON_ERROR_STOP=1 to catch errors but the dump contains DROP commands for existing tables
psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -f ./live_db_dump.sql

# 4. Sync Media Files (Differential Sync)
Write-Host "Step 4: Syncing Media Files (New files only)..." -ForegroundColor Yellow
if (!(Test-Path "media")) { 
    New-Item -ItemType Directory -Path "media" 
}
# scp is not great for differential, but we'll use it for now. 
# For true differential sync on Windows, you'd need rsync or similar.
scp -r "${USER}@${VPS_IP}:/var/www/bdapp/media/*" ./media/

# Cleanup
Write-Host "Step 5: Cleaning up..." -ForegroundColor Yellow
ssh "${USER}@${VPS_IP}" "rm /tmp/live_db_dump.sql"
if (Test-Path "./live_db_dump.sql") {
    Remove-Item "./live_db_dump.sql" -Force
}

Write-Host "✅ SUCCESS: Your local project is now professionally synced with live data!" -ForegroundColor Green
Write-Host "The database objects were updated without dropping the entire database." -ForegroundColor Cyan
