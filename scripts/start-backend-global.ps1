$ErrorActionPreference = 'Continue'

$manage = Join-Path $PSScriptRoot '..\manage.py'

# Force Postgres for backend runs
$env:USE_POSTGRES = '1'

# Ensure database is migrated
py -3.11 $manage migrate

# Start Django dev server
py -3.11 $manage runserver 127.0.0.1:8000
