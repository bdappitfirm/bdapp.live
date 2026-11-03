import os
import sys
import django

sys.path.insert(0, 'F:/bdedu')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import Subject

all_names = list(Subject.objects.values_list('name', flat=True).distinct())
print(f"All {len(all_names)} distinct subject names:")
for n in sorted(all_names):
    print(f"  - {repr(n)}")
