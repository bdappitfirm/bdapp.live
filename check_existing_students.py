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
print(f"Checking existing students for school: {school.name}")

# Check Six and Seven classes
for class_name in ["Six", "Seven"]:
    try:
        classroom = ClassRoom.objects.get(school=school, name=class_name)
        print(f"\n--- {class_name} ---")
        sections = Section.objects.filter(classroom=classroom)
        for section in sections:
            students = StudentProfile.objects.filter(school=school, classroom=classroom, section=section)
            print(f"  {section.name}: {students.count()} students")
            for student in students[:5]:  # Show first 5
                print(f"    - Roll: {student.roll_number}, User: {student.user.username}")
    except ClassRoom.DoesNotExist:
        print(f"\n--- {class_name} --- NOT FOUND")
