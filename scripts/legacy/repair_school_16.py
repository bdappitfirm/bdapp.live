
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import Subject, ClassRoom

def repair():
    school_id = 16
    subjects = Subject.objects.filter(school_id=school_id)
    print(f"Repairing {subjects.count()} subjects for school {school_id}...")

    for s in subjects:
        # Get classrooms linked via sections
        linked_via_sections = [sec.classroom for sec in s.sections.all()]

        # Add them to classrooms M2M if not already there
        for cls in linked_via_sections:
            if cls not in s.classrooms.all():
                s.classrooms.add(cls)
                print(f"  - Linked '{s.name}' to Classroom '{cls.name}'")

        # Double check: if still no classroom, link to first classroom as a safety measure
        if s.classrooms.count() == 0:
            first_cls = ClassRoom.objects.filter(school_id=school_id).first()
            if first_cls:
                s.classrooms.add(first_cls)
                print(f"  - Safety link: '{s.name}' to '{first_cls.name}'")

if __name__ == "__main__":
    repair()
