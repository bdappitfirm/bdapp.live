import os
import django
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in os.sys.path:
    os.sys.path.insert(0, str(ROOT_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import User

print("Looking for numeric usernames to delete...")
deleted = 0

# Get all users and check if their username is numeric
all_users = User.objects.all()
for user in all_users:
    if user.username.replace('0', '').isdigit() or user.username.startswith(('06', '07', '08', '09', '10')):
        print(f"  Deleting user: {user.username}")
        user.delete()
        deleted += 1

print(f"\n✅ Deleted {deleted} users")
