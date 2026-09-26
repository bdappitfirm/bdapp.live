import os
import django
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in os.sys.path:
    os.sys.path.insert(0, str(ROOT_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School

# Check if school 11 exists
if not School.objects.filter(id=11).exists():
    School.objects.create(id=11, name="Demo School 11")
    print("Created School with id 11!")
else:
    print(f"School 11 exists: {School.objects.get(id=11).name}")

print(f"Total schools: {School.objects.count()}")
