import os
import django
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.core.management import call_command

# Disable all signals temporarily
from django.db.models.signals import post_save
from django.contrib.auth.signals import user_logged_in

# Save the old receivers
old_post_save_receivers = post_save.receivers.copy()
old_login_receivers = user_logged_in.receivers.copy()

# Clear them
post_save.receivers.clear()
user_logged_in.receivers.clear()

print("Loading data...")
try:
    call_command('loaddata', 'db_dump_simple.json')
    print("Data loaded successfully!")
finally:
    # Restore the receivers
    post_save.receivers = old_post_save_receivers
    user_logged_in.receivers = old_login_receivers
    print("Signals restored!")
