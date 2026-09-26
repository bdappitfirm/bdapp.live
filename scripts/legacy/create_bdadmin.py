import os
import django
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in os.sys.path:
    os.sys.path.insert(0, str(ROOT_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import User
from schools.models import School

# Create superuser
if not User.objects.filter(username='bdadmin').exists():
    User.objects.create_superuser('bdadmin', 'bdadmin@bdapp.live', 'Bangladesh@4321$')
    print('Superuser bdadmin created successfully!')
else:
    print('Superuser bdadmin already exists!')

# Check schools
print(f"Total schools: {School.objects.count()}")
