import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Examination, Result, StudentOverallResult
from results.signals import calculate_student_overall_result, calculate_ranks
from academics.models import StudentProfile

def run():
    school_id = 16

    print(f"Fixing Merit List for School {school_id}")

    # 1. Clear all existing OVRs for this school to avoid any confusion
    deleted_count, _ = StudentOverallResult.objects.filter(examination__school_id=school_id).delete()
    print(f"Deleted {deleted_count} stale overall results.")

    # 2. Get all remaining examinations (should be merged already)
    exams = Examination.objects.filter(school_id=school_id)

    for exam in exams:
        print(f"Processing Exam: {exam.name} (ID: {exam.id}) for Class: {exam.classroom.name}")

        # Recalculate individual results to ensure they are up to date
        for r in Result.objects.filter(examination=exam).iterator():
            r.save()

        # Get all students in the classroom
        students = StudentProfile.objects.filter(classroom=exam.classroom, school_id=school_id)
        print(f"  Calculating OVR for {students.count()} students...")
        for s in students:
            calculate_student_overall_result(exam, s)

        # Calculate ranks
        print(f"  Calculating ranks...")
        calculate_ranks(exam)

    print("Done fixing School 16.")

if __name__ == "__main__":
    run()
