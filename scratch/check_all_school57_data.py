import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from academics.models import ClassRoom, Section, StudentProfile

school = School.objects.get(id=57)
print('School:', school.name)

classrooms = ClassRoom.objects.filter(school=school)
for cr in classrooms:
    st_count = StudentProfile.objects.filter(school=school, classroom=cr).count()
    print(f"Classroom: {cr.id} - {cr.name} -> Students: {st_count}")
    sections = Section.objects.filter(classroom=cr)
    for sec in sections:
        sec_st_count = StudentProfile.objects.filter(school=school, classroom=cr, section=sec).count()
        print(f"   Section: {sec.id} - {sec.name} -> Students: {sec_st_count}")
