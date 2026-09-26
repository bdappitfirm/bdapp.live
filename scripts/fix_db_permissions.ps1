$ErrorActionPreference = 'Continue'

$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^PG_PASSWORD=' }
    if ($line) { $env:PGPASSWORD = ($line -replace '^PG_PASSWORD=','').Trim() }
}
if (-not $env:PGPASSWORD) { Write-Error 'PG_PASSWORD not found in .env or the environment.'; exit 1 }
$pgPath = "C:\Program Files\PostgreSQL\16\bin"
$env:Path += ";$pgPath"

# Drop database if exists
Write-Host "Dropping existing database..."
dropdb -U postgres -f local_pg_db

# Create database
Write-Host "Creating database..."
createdb -U postgres local_pg_db

# Grant privileges
Write-Host "Granting privileges..."
psql -U postgres -d local_pg_db -c "GRANT ALL PRIVILEGES ON DATABASE local_pg_db TO local_pg_user;"
psql -U postgres -d local_pg_db -c "GRANT ALL ON SCHEMA public TO local_pg_user;"
psql -U postgres -d local_pg_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO local_pg_user;"
psql -U postgres -d local_pg_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO local_pg_user;"

Write-Host "Database fixed!"
