import os
import django
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.core.management import call_command

with open('db_dump_simple.json', 'w', encoding='utf-8') as f:
    call_command(
        'dumpdata',
        exclude=['contenttypes', 'auth.Permission', 'sessions', 'admin.LogEntry'],
        stdout=f
    )

print("Dumped to db_dump_simple.json")
