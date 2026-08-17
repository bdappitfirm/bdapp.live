import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Examination, Result, StudentOverallResult
from results.signals import calculate_student_overall_result, calculate_ranks
from academics.models import StudentProfile

def run():
    school_id = 62
    print(f"Fixing School {school_id}...")

    # 1. Recalculate individual results to apply religion logic if needed
    # Actually religion logic is in calculate_student_overall_result, so we just need that.

    exams = Examination.objects.filter(school_id=school_id)
    for exam in exams:
        if exam.results.count() < 2: continue
        print(f"  Processing Exam: {exam.name} ({exam.id})")

        # Recalculate OVR for all students
        students = StudentProfile.objects.filter(classroom=exam.classroom, school_id=school_id)
        for s in students:
            calculate_student_overall_result(exam, s)

        # Calculate ranks
        calculate_ranks(exam)
    print("Done.")

if __name__ == "__main__":
    run()
