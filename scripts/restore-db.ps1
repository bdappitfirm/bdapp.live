$ErrorActionPreference = 'Continue'

# Set PostgreSQL password from .env / the environment (never hardcode credentials)
$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^PG_PASSWORD=' }
    if ($line) { $env:PGPASSWORD = ($line -replace '^PG_PASSWORD=','').Trim() }
}
if (-not $env:PGPASSWORD) { Write-Error 'PG_PASSWORD not found in .env or the environment.'; exit 1 }

# Get PostgreSQL path - check common paths
$pgPath = "C:\Program Files\PostgreSQL\16\bin"
if (!(Test-Path $pgPath)) {
    $pgPath = "C:\Program Files\PostgreSQL\15\bin"
}
$env:Path += ";$pgPath"

Write-Host "Restoring database..."

# Drop and recreate the database
dropdb -U postgres local_pg_db
createdb -U postgres local_pg_db

# Restore the backup
psql -U postgres -d local_pg_db -f "e:\project\local_db_clean.sql"

Write-Host "Database restored successfully!"
