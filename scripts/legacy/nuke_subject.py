
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import Subject, ClassRoom
from results.models import Result

def nuke():
    school_id = 16
    # 1. Target "হিসাববিজ্ঞান" for school 16 specifically
    subjects = Subject.objects.filter(school_id=school_id, name__icontains='হিসাববিজ্ঞান')

    for s in subjects:
        res_count = Result.objects.filter(subject=s).count()
        if res_count == 0:
            print(f"Nuking subject with 0 results: {s.name} (ID: {s.id})")
            s.delete()
        else:
            print(f"Subject {s.name} (ID: {s.id}) has {res_count} results. Moving it to first class to make it visible.")
            s.classrooms.clear()
            first_cls = ClassRoom.objects.filter(school_id=school_id).first()
            if first_cls:
                s.classrooms.add(first_cls)
                print(f"  -> Linked to {first_cls.name}")

    # 2. Also check for any other subject that might have no classrooms linked
    orphans = Subject.objects.filter(school_id=school_id, classrooms=None, sections=None)
    for o in orphans:
        print(f"Found orphan: {o.name}. Linking to first class.")
        first_cls = ClassRoom.objects.filter(school_id=school_id).first()
        if first_cls:
            o.classrooms.add(first_cls)

if __name__ == "__main__":
    nuke()
