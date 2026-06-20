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
from academics.models import ClassRoom, Section, StudentProfile

# Get school with id 63
school = School.objects.get(id=63)
print(f"Checking school: {school.name}")

# Check all classes
all_students = StudentProfile.objects.filter(school=school)
print(f"\nTotal students in school: {all_students.count()}")

# Count per class
for class_name in ["Six", "Seven", "Eight", "Nine", "Ten"]:
    try:
        classroom = ClassRoom.objects.get(school=school, name=class_name)
        students = StudentProfile.objects.filter(school=school, classroom=classroom)
        print(f"\n--- {class_name} ---")
        print(f"  Total: {students.count()}")
        sections = Section.objects.filter(classroom=classroom)
        for section in sections:
            sec_students = students.filter(section=section)
            print(f"  {section.name}: {sec_students.count()}")
            # Show roll numbers
            rolls = [s.roll_number for s in sec_students.order_by('roll_number')]
            print(f"  Rolls: {rolls[:20]}")  # First 20 rolls
    except ClassRoom.DoesNotExist:
        print(f"\n--- {class_name} --- NOT FOUND")
