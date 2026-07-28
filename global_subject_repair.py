
import os
import django
from django.db.models import Count

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import Subject, ClassRoom, Section
from results.models import Result

def repair_all_schools():
    print("--- Starting Global Subject Repair System ---")

    # 1. Clean up truly empty ghost subjects (0 results AND 0 links)
    empty_ghosts = Subject.objects.annotate(
        cls_count=Count('classrooms', distinct=True),
        sec_count=Count('sections', distinct=True)
    ).filter(cls_count=0, sec_count=0)

    deleted_count = 0
    for s in empty_ghosts:
        res_count = Result.objects.filter(subject=s).count()
        if res_count == 0:
            print(f"  [DELETE] Ghost Subject: {s.name} (School: {s.school.name})")
            s.delete()
            deleted_count += 1

    # 2. Fix subjects that HAVE results but are HIDDEN (no classrooms linked)
    # Also fix subjects linked to sections but not classrooms
    all_subjects = Subject.objects.all()
    repaired_count = 0

    for s in all_subjects:
        # Check if linked to any classroom
        has_class = s.classrooms.exists()
        # Check if linked via sections
        sections = s.sections.all()

        # Action A: If linked to sections, must be linked to their parent classrooms
        for sec in sections:
            if sec.classroom not in s.classrooms.all():
                s.classrooms.add(sec.classroom)
                print(f"  [FIX] Linked '{s.name}' to parent class '{sec.classroom.name}' (School: {s.school.name})")
                repaired_count += 1

        # Action B: If still no classroom but has results OR is just existing
        # We link to first class to ensure visibility in frontend
        if not s.classrooms.exists():
            first_cls = ClassRoom.objects.filter(school=s.school).first()
            if first_cls:
                s.classrooms.add(first_cls)
                print(f"  [VISIBLE] Moved orphan '{s.name}' to '{first_cls.name}' for visibility (School: {s.school.name})")
                repaired_count += 1

    print(f"\nSummary:")
    print(f"Total Ghost Subjects Deleted: {deleted_count}")
    print(f"Total Subjects Repaired/Made Visible: {repaired_count}")
    print("--- Repair Complete ---")

if __name__ == "__main__":
    repair_all_schools()
