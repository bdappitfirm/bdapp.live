import os
import django

# Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile
from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()

def cleanup():
    print("🔍 Scanning for orphaned students (ghost records)...")

    # Find students without a classroom OR without a roll number
    orphaned = StudentProfile.objects.filter(classroom__isnull=True)
    no_roll = StudentProfile.objects.filter(roll_number__isnull=True) | StudentProfile.objects.filter(roll_number='')

    targets = orphaned | no_roll
    total = targets.count()

    if total == 0:
        print("✅ No orphaned students found. Database is clean!")
        return

    print(f"🚩 Found {total} ghost records. Starting cleanup...")

    try:
        with transaction.atomic():
            user_ids = list(targets.values_list('user_id', flat=True))
            # Delete users (this will cascade delete student profiles)
            deleted_count, _ = User.objects.filter(id__in=user_ids).delete()
            print(f"🚀 Success! Deleted {deleted_count} ghost student accounts.")
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")

if __name__ == "__main__":
    cleanup()
