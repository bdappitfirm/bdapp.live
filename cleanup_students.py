import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile

def cleanup():
    print("🔍 Searching for students without sections...")
    orphans = StudentProfile.objects.filter(section__isnull=True)
    count = orphans.count()

    if count == 0:
        print("✅ No orphaned students found.")
        return

    print(f"⚠️ Found {count} students without sections.")

    for student in orphans:
        name = f"{student.user.first_name} {student.user.last_name}" if student.user else "Unknown"
        print(f"🗑️ Deleting orphan: {name} (ID: {student.id})")

        # Optionally delete the user account too
        user = student.user
        student.delete()
        if user:
            user.delete()

    print(f"✅ Cleanup complete. Deleted {count} records.")

if __name__ == "__main__":
    cleanup()
