import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import ClassRoom, Section, StudentProfile

classroom = ClassRoom.objects.get(id=208)
print('Classroom:', classroom.name, 'School ID:', classroom.school_id)

# Check if section 'গ' exists for classroom 208
section_ga, created = Section.objects.get_or_create(
    classroom=classroom,
    name='গ'
)
if created:
    print('Created Section "গ" for classroom 208 (ID:', section_ga.id, ')')
else:
    print('Section "গ" already exists for classroom 208 (ID:', section_ga.id, ')')

# Find students in classroom 208 with no section or null section
unassigned_students = StudentProfile.objects.filter(school_id=57, classroom=classroom, section__isnull=True)
print(f'Found {unassigned_students.count()} unassigned students in class 6.')

updated_count = unassigned_students.update(section=section_ga)
print(f'Assigned {updated_count} students to Section "গ".')

# Verify sections breakdown now
from django.db.models import Count
breakdown = StudentProfile.objects.filter(school_id=57, classroom=classroom).values('section__name', 'section_id').annotate(cnt=Count('id'))
print('New sections breakdown for class 6:', list(breakdown))
