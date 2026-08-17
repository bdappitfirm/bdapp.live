import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Examination, Result, StudentOverallResult
from results.signals import calculate_student_overall_result, calculate_ranks
from academics.models import StudentProfile

def run(target_school_id=None):
    print("Starting merit list recalculation...")

    if target_school_id:
        school_ids = [target_school_id]
    else:
        # Get all schools that have results
        school_ids = Result.objects.values_list('examination__school_id', flat=True).distinct()

    for school_id in school_ids:
        if not school_id: continue
        print(f"\nProcessing School ID: {school_id}")

        # 1. Clear stale OVRs
        deleted_count, _ = StudentOverallResult.objects.filter(examination__school_id=school_id).delete()
        print(f"  Deleted {deleted_count} stale overall results.")

        # 2. Get all examinations
        exams = Examination.objects.filter(school_id=school_id)

        for exam in exams:
            res_count = exam.results.count()
            if res_count < 2: continue

            print(f"  Exam: {exam.name} (ID: {exam.id}) - {exam.classroom.name}")

            # 3. Get all students in the classroom
            students = StudentProfile.objects.filter(classroom=exam.classroom, school_id=school_id)
            for s in students:
                calculate_student_overall_result(exam, s)

            # 4. Calculate ranks
            calculate_ranks(exam)

    print("\n[SUCCESS] Recalculation complete.")

if __name__ == "__main__":
    sid = None
    if len(sys.argv) > 1:
        try:
            sid = int(sys.argv[1])
        except: pass
    run(sid)
