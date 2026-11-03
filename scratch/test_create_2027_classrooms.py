import os
import sys
import django

sys.path.insert(0, 'F:/bdedu')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from academics.models import ClassRoom, Section, Subject

def run_dry_run():
    print("=== DRY RUN: CREATING 2027 CLASSROOMS & SECTIONS ===")
    schools = School.objects.all()
    created_classes_count = 0
    created_sections_count = 0

    for school in schools:
        existing_classrooms = list(ClassRoom.objects.filter(school=school))
        for c in existing_classrooms:
            # Skip if already a 2027 classroom
            if '2027' in c.name or '২০২৭' in c.name:
                continue

            target_name = f"{c.name.strip()}-২০২৭"
            created_classes_count += 1
            secs = list(c.sections.all())
            created_sections_count += len(secs)

    print(f"Total Schools Processed: {schools.count()}")
    print(f"ClassRooms to be created: {created_classes_count}")
    print(f"Sections to be created: {created_sections_count}")

if __name__ == '__main__':
    run_dry_run()
