import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import transaction
from schools.models import School
from academics.models import ClassRoom, Section, Subject

def create_2027_classrooms():
    print("=== EXECUTING: CREATING 2027 CLASSROOMS & SECTIONS FOR ALL SCHOOLS ===")

    total_classrooms_created = 0
    total_sections_created = 0
    total_subjects_linked = 0

    schools = School.objects.all().order_by('id')

    with transaction.atomic():
        for school in schools:
            # Get existing classrooms that do NOT contain 2027 or ২০২৭
            original_classrooms = list(ClassRoom.objects.filter(school=school))

            for c in original_classrooms:
                if '2027' in c.name or '২০২৭' in c.name:
                    continue

                target_name = f"{c.name.strip()}-২০২৭"

                # Create or get 2027 ClassRoom
                new_classroom, created_c = ClassRoom.objects.get_or_create(
                    school=school,
                    name=target_name,
                    defaults={'description': c.description or ''}
                )
                if created_c:
                    total_classrooms_created += 1

                # Copy sections
                section_map = {} # old_sec_id -> new_sec_obj
                for s in c.sections.all():
                    new_section, created_s = Section.objects.get_or_create(
                        classroom=new_classroom,
                        name=s.name
                    )
                    if created_s:
                        total_sections_created += 1
                    section_map[s.id] = new_section

                # Copy subject links
                classroom_subjects = list(c.subjects.all())
                for subj in classroom_subjects:
                    subj.classrooms.add(new_classroom)
                    total_subjects_linked += 1

                    # Also link section-specific subjects
                    for old_sec_id, new_sec_obj in section_map.items():
                        if subj.sections.filter(id=old_sec_id).exists():
                            subj.sections.add(new_sec_obj)

    print("\n=== COMPLETED SUCCESSFULLY ===")
    print(f"Total Schools Processed: {schools.count()}")
    print(f"Total New 2027 ClassRooms Created: {total_classrooms_created}")
    print(f"Total New 2027 Sections Created: {total_sections_created}")
    print(f"Total Subject-Classroom Links Added: {total_subjects_linked}")

if __name__ == '__main__':
    create_2027_classrooms()
