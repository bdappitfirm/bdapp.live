
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import Subject, ClassRoom, Section
from results.models import Result
from django.db.models import Count

def final_cleanup():
    print("--- Final Ghost Subject Cleanup ---")

    # 1. Find all subjects with 0 results
    all_subjects = Subject.objects.all()
    deleted_count = 0

    for s in all_subjects:
        res_count = Result.objects.filter(subject=s).count()
        if res_count == 0:
            # Check if it was one of the auto-generated ones (optional check)
            # Actually, the user wants all ghosts gone.
            print(f"Deleting subject with 0 results: {s.name} (ID: {s.id}) from school {s.school.name}")
            s.delete()
            deleted_count += 1

    print(f"Total deleted subjects: {deleted_count}")

    # 2. For subjects WITH results but NO classroom, ensure they are visible
    orphans_with_results = Subject.objects.annotate(
        cls_count=Count('classrooms', distinct=True),
        sec_count=Count('sections', distinct=True)
    ).filter(cls_count=0, sec_count=0)

    linked_count = 0
    for s in orphans_with_results:
        first_cls = ClassRoom.objects.filter(school=s.school).first()
        if first_cls:
            s.classrooms.add(first_cls)
            print(f"Linked orphaned subject with results to classroom: {s.name} -> {first_cls.name}")
            linked_count += 1

    print(f"Total linked subjects: {linked_count}")
    print("Cleanup complete.")

if __name__ == "__main__":
    final_cleanup()
