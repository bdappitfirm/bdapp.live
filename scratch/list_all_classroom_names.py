import os
import sys
import django

sys.path.insert(0, 'F:/bdedu')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import ClassRoom

class_names = list(ClassRoom.objects.values_list('name', flat=True).distinct())
print(f"Total distinct classroom names ({len(class_names)}):")
for name in sorted(class_names):
    print(f"  - {name}")
