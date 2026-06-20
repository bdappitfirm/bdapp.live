$ErrorActionPreference = 'Continue'

$env:PGPASSWORD = 'Bangladesh@4321$'
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
