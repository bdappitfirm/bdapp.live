import os
import sys
import unicodedata
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import transaction
from schools.models import School
from academics.models import ClassRoom, Section, Subject

def clean_str(val):
    if not val:
        return ''
    return unicodedata.normalize('NFKC', str(val)).strip()

def create_2027_and_default_sections():
    print("=== EXECUTING: CREATING DEFAULT SECTIONS & 2027 CLASSROOMS FOR ALL SCHOOLS ===")

    total_default_sections_created = 0
    total_2027_classrooms_created = 0
    total_2027_sections_created = 0
    total_subjects_linked = 0

    schools = list(School.objects.all().order_by('id'))

    with transaction.atomic():
        for school in schools:
            # 1. Ensure all existing classrooms have at least section 'ক'
            existing_classrooms = list(ClassRoom.objects.filter(school=school))

            for c in existing_classrooms:
                if '2027' in c.name or '২০২৭' in c.name:
                    continue

                # If classroom has 0 sections, create default section 'ক'
                if c.sections.count() == 0:
                    Section.objects.create(classroom=c, name='ক')
                    total_default_sections_created += 1

            # Re-fetch updated classrooms
            base_classrooms = list(ClassRoom.objects.filter(school=school))

            for c in base_classrooms:
                if '2027' in c.name or '২০২৭' in c.name:
                    continue

                target_name = f"{clean_str(c.name)}-২০২৭"

                # Create 2027 ClassRoom
                new_classroom, created_c = ClassRoom.objects.get_or_create(
                    school=school,
                    name=target_name,
                    defaults={'description': c.description or ''}
                )
                if created_c:
                    total_2027_classrooms_created += 1

                # Copy sections
                section_map = {}
                for s in c.sections.all():
                    new_sec, created_s = Section.objects.get_or_create(
                        classroom=new_classroom,
                        name=s.name
                    )
                    if created_s:
                        total_2027_sections_created += 1
                    section_map[s.id] = new_sec

                # Link subjects
                classroom_subjs = list(c.subjects.all())
                for subj in classroom_subjs:
                    subj.classrooms.add(new_classroom)
                    total_subjects_linked += 1

                    for old_sec_id, new_sec_obj in section_map.items():
                        if subj.sections.filter(id=old_sec_id).exists():
                            subj.sections.add(new_sec_obj)

    print("\n=== COMPLETED SUCCESSFULLY ===")
    print(f"Total Schools Processed: {len(schools)}")
    print(f"Default Sections ('ক') Created for Base Classes: {total_default_sections_created}")
    print(f"Total New 2027 ClassRooms Created: {total_2027_classrooms_created}")
    print(f"Total New 2027 Sections Created: {total_2027_sections_created}")
    print(f"Total Subject-Classroom Links Added: {total_subjects_linked}")

if __name__ == '__main__':
    create_2027_and_default_sections()
