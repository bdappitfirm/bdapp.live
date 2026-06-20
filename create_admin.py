import os
import django
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in os.sys.path:
    os.sys.path.insert(0, str(ROOT_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import User, Profile
from schools.models import School

school = School.objects.get(id=63)

print("Checking for admin user...")
try:
    admin_user = User.objects.get(username="bdadmin")
    print("Admin user exists!")
except User.DoesNotExist:
    print("Creating admin user...")
    admin_user = User.objects.create_superuser(
        username="bdadmin",
        email="admin@bdapp.live",
        password="12345678"
    )
    print("Admin user created!")

print("Checking for admin profile...")
try:
    admin_profile = Profile.objects.get(user=admin_user)
    print("Admin profile exists!")
except Profile.DoesNotExist:
    print("Creating admin profile...")
    Profile.objects.create(
        user=admin_user,
        school=school,
        role="admin"
    )
    print("Admin profile created!")

print("\n✅ Admin user is ready!")
print("   Username: bdadmin")
print("   Password: 12345678")
