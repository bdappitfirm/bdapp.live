import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import ClassRoom, Section, StudentProfile

classroom = ClassRoom.objects.get(id=209)
print('Classroom:', classroom.name, 'School ID:', classroom.school_id)

# Get first section of classroom 209 (e.g. section 'ক')
sec = Section.objects.filter(classroom=classroom).first()
if sec:
    unassigned = StudentProfile.objects.filter(school_id=57, classroom=classroom, section__isnull=True)
    count = unassigned.update(section=sec)
    print(f'Assigned {count} unassigned students in class 8 to section {sec.name}')
