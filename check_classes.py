import os
import django
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in os.sys.path:
    os.sys.path.insert(0, str(ROOT_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from academics.models import ClassRoom, Section

for school_id in [11, 63]:
    school = School.objects.get(id=school_id)
    print(f"\n===== School: {school.name} (ID: {school_id}) =====")
    class_rooms = ClassRoom.objects.filter(school=school)
    print(f"ClassRooms (total {class_rooms.count()}):")
    for cr in class_rooms:
        sections = Section.objects.filter(classroom=cr)
        section_names = [s.name for s in sections]
        print(f"  - {cr.name} (ID: {cr.id}) -> Sections: {section_names}")
