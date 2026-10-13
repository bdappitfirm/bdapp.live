import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile, ClassRoom

print('Total StudentProfiles for school 57:', StudentProfile.objects.filter(school_id=57).count())
print('Classrooms for school 57:', list(ClassRoom.objects.filter(school_id=57).values('id', 'name')))
