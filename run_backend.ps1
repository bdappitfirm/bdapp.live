$ErrorActionPreference = 'Stop'
. '.venv\Scripts\Activate.ps1'
$env:USE_POSTGRES = '0'
python manage.py migrate --noinput
python manage.py runserver 127.0.0.1:8000
