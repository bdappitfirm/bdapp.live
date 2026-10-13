import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile, ClassRoom, Section
from django.db.models import Count

unassigned = StudentProfile.objects.filter(section__isnull=True).values('school_id', 'classroom_id', 'classroom__name').annotate(cnt=Count('id'))
print('Unassigned students by school/classroom:', list(unassigned))
