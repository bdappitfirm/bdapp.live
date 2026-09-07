import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

try:
    from users.serializers import TeacherProfileSerializer
    print("TeacherProfileSerializer imported successfully:", TeacherProfileSerializer)
except Exception as e:
    print(f"Import failed: {type(e).__name__}: {e}")
