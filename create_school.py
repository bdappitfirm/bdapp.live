
import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from schools.models import School

if not School.objects.filter(id=16).exists():
    school = School.objects.create(
        name="বাংলাদেশ স্কুল",
        address="ঢাকা",
        phone_number="01700000000",
        email="school@example.com"
    )
    print(f"Created school: {school.name} (ID: {school.id})")
else:
    school = School.objects.get(id=16)
    print(f"School already exists: {school.name}")
