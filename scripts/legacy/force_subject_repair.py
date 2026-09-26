
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import Subject, ClassRoom, TeacherAssignment, VirtualClass
from results.models import Result, ExamSlot
from django.db.models import Count

def force_repair(school_id):
    print(f"--- Force Repairing School {school_id} ---")
    subjects = Subject.objects.filter(school_id=school_id)

    for s in subjects:
        # Check if actually linked to a classroom
        cls_count = s.classrooms.count()
        if cls_count == 0:
            first_cls = ClassRoom.objects.filter(school_id=school_id).first()
            if first_cls:
                s.classrooms.add(first_cls)
                print(f"  [FIXED] Linked Orphan '{s.name}' (ID: {s.id}) to '{first_cls.name}'")

        # Normalize Name
        clean_name = s.name.strip()
        if clean_name != s.name:
            s.name = clean_name
            s.save()

def check_dependencies(subject_id):
    s = Subject.objects.filter(id=subject_id).first()
    if not s:
        print(f"Subject {subject_id} not found.")
        return

    results = Result.objects.filter(subject=s).count()
    assignments = TeacherAssignment.objects.filter(subject=s).count()
    slots = ExamSlot.objects.filter(subject=s).count()

    print(f"Subject: {s.name} (ID: {s.id})")
    print(f"  - Results: {results}")
    print(f"  - Teacher Assignments: {assignments}")
    print(f"  - Exam Slots: {slots}")

if __name__ == "__main__":
    for sid in [16, 19]:
        force_repair(sid)

    # Specific check for IDs from your log
    print("\nChecking IDs from logs:")
    check_dependencies(164)
    check_dependencies(170)
