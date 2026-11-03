import os
import sys
import django

sys.path.insert(0, 'F:/bdedu')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from academics.models import ClassRoom, Section

school_19 = School.objects.filter(id=19).first()
if school_19:
    print(f"=== SCHOOL 19 ({school_19.name}) ALL CLASSROOMS & SECTIONS ===")
    classrooms = ClassRoom.objects.filter(school=school_19)
    print(f"Total ClassRooms in DB for School 19: {classrooms.count()}")
    for c in classrooms:
        secs = list(c.sections.all().values_list('name', flat=True))
        st_count = c.students.count()
        print(f"  ID {c.id:3d}: {c.name:25s} | Sections ({len(secs)}): {secs} | Students: {st_count}")
