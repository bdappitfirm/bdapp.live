import os
import sys
import django

sys.path.insert(0, 'F:/bdedu')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from academics.models import ClassRoom, Section, Subject

print("=== SCHOOL & CLASSROOM SUMMARY ===")
schools = School.objects.all()
print(f"Total Schools: {schools.count()}")

total_classrooms = ClassRoom.objects.count()
total_sections = Section.objects.count()
print(f"Total ClassRooms: {total_classrooms}")
print(f"Total Sections: {total_sections}")

class_2027_count = ClassRoom.objects.filter(name__icontains='2027').count()
print(f"ClassRooms already having 2027: {class_2027_count}")

school_19 = School.objects.filter(id=19).first()
if school_19:
    print(f"\n--- School 19 ({school_19.name}) ---")
    c_list = ClassRoom.objects.filter(school=school_19)
    for c in c_list:
        secs = list(c.sections.values_list('name', flat=True))
        print(f"  Class ID {c.id}: {c.name} | Sections: {secs}")
