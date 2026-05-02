import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

import django
django.setup()

from users.models import User, Profile
from django.conf import settings

# Check if settings are configured for PostgreSQL
print("Current DB:")
print(f"ENGINE: {settings.DATABASES['default']['ENGINE']}")
print(f"NAME: {settings.DATABASES['default']['NAME']}")

# Check imam user
try:
    user = User.objects.get(username='imam')
    profile = Profile.objects.filter(user=user).first()
    print(f"\nUser: {user.username} (ID: {user.id})")
    print(f"Profile Role: {profile.role if profile else 'No profile'}")
    print(f"Profile Designation: {profile.designation if profile else 'No designation'}")
    
    # Check effective_role logic
    if profile and profile.designation == 'প্রধান শিক্ষক':
        print("✓ Designation is correct: প্রধান শিক্ষক")
        print("✓ Should show as admin role in API")
    else:
        print(f"! Designation issue. Current: {profile.designation if profile else 'None'}")
        print("! Need to set designation to 'প্রধান শিক্ষক' for principal role")
except User.DoesNotExist:
    print("User 'imam' not found")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
