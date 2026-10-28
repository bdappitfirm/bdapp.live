import os
import django
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in os.sys.path:
    os.sys.path.insert(0, str(ROOT_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from academics.models import ClassRoom, Section, StudentProfile
from users.models import User, Profile

school = School.objects.get(id=57)
classroom = ClassRoom.objects.get(id=211)
section = Section.objects.get(id=470)

print(f"Before generation: {StudentProfile.objects.filter(school=school, classroom=classroom, section=section).count()} students")

count = 5
created_count = 0
for roll in range(1, count + 1):
    roll_str = str(roll)
    if StudentProfile.objects.filter(school=school, classroom=classroom, section=section, roll_number=roll_str).exists():
        continue
    uname = f"s57c211s470r{roll}"
    user, _ = User.objects.get_or_create(
        username=uname,
        defaults={'first_name': roll_str, 'last_name': ''}
    )
    if not user.first_name:
        user.first_name = roll_str
        user.save()
    Profile.objects.update_or_create(user=user, defaults={'school': school, 'role': 'student'})
    StudentProfile.objects.get_or_create(
        user=user,
        school=school,
        classroom=classroom,
        section=section,
        defaults={'roll_number': roll_str}
    )
    created_count += 1

print(f"Created {created_count} students.")
print(f"After generation: {StudentProfile.objects.filter(school=school, classroom=classroom, section=section).count()} students")
for s in StudentProfile.objects.filter(school=school, classroom=classroom, section=section):
    print(f"Roll: {s.roll_number}, Name: {s.user.first_name}")
