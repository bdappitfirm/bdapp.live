import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import ClassRoom, StudentProfile
from django.db.models import Count

print('Classrooms in school 57:')
for cr in ClassRoom.objects.filter(school_id=57):
    print(f"ID: {cr.id}, Name: '{cr.name}', Students count: {StudentProfile.objects.filter(school_id=57, classroom=cr).count()}")

print('\nCheck students by classroom field values (raw/unfiltered):')
for st in StudentProfile.objects.filter(school_id=57)[:20]:
    print(f"Student: {st.user.username if st.user else 'No user'}, Classroom ID: {st.classroom_id}, Classroom Name: {st.classroom.name if st.classroom else 'None'}")
