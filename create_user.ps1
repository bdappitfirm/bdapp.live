$ErrorActionPreference = 'Stop'
. '.venv\Scripts\Activate.ps1'
$env:USE_POSTGRES = '0'
python create_superuser.py
