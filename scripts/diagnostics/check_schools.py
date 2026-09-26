import os
import django
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in os.sys.path:
    os.sys.path.insert(0, str(ROOT_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from academics.models import StudentProfile

print("Checking all schools:")
all_schools = School.objects.all().order_by('id')
for school in all_schools:
    count = StudentProfile.objects.filter(school=school).count()
    print(f"  ID {school.id:2d}: {school.name:<40} - {count} students")
