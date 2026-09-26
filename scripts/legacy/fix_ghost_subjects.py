
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import Subject, ClassRoom, Section
from results.models import Result
from django.db.models import Count

def fix_ghost_subjects():
    print("--- Final Aggressive Subject Cleanup ---")

    # 1. Delete subjects with NO classrooms, NO sections AND NO results
    ghosts = Subject.objects.annotate(
        cls_count=Count('classrooms', distinct=True),
        sec_count=Count('sections', distinct=True)
    ).filter(cls_count=0, sec_count=0)

    deleted = 0
    for s in ghosts:
        res_count = Result.objects.filter(subject=s).count()
        if res_count == 0:
            s.delete()
            deleted += 1

    print(f"Deleted {deleted} truly orphaned ghost subjects (no class, no section, no results).")

    # 2. Check for duplicate subjects with same name in same school
    # If one has class and other doesn't, delete the one without class (if no results)
    school_ids = Subject.objects.values_list('school_id', flat=True).distinct()
    for sid in school_ids:
        names = Subject.objects.filter(school_id=sid).values_list('name', flat=True).distinct()
        for name in names:
            dupes = Subject.objects.filter(school_id=sid, name=name).annotate(
                cls_count=Count('classrooms', distinct=True)
            ).order_by('-cls_count', 'id')

            if dupes.count() > 1:
                # Keep the first one (most likely linked)
                primary = dupes[0]
                others = dupes[1:]
                for other in others:
                    other_res = Result.objects.filter(subject=other).count()
                    if other_res == 0:
                        print(f"Deleting duplicate subject '{name}' (ID: {other.id}) in School {sid}")
                        other.delete()

    print("Cleanup complete.")

if __name__ == "__main__":
    fix_ghost_subjects()
