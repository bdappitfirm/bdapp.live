import os
import django
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Examination, Result, StudentOverallResult
from results.signals import calculate_student_overall_result, calculate_ranks
from academics.models import StudentProfile

def run():
    school_id = 62
    print(f"Verifying Fix for School {school_id}")

    # 1. Target student: Karnajit (Roll 3, Class 6)
    s = StudentProfile.objects.filter(school_id=school_id, classroom_id=237, roll_number='3').first()
    if not s:
        print("Student not found")
        return
    print(f"Found student: {s.user.get_full_name()} (ID: {s.id})")

    # 2. Trigger Result.save() for ALL his results
    results = Result.objects.filter(student=s)
    print(f"Results for student: {results.count()}")
    for r in results:
        r.save()
        print(f"  - {r.subject.name}: {r.total_obtained}, Passed: {r.is_passed}, Grade: {r.grade}")

    # 3. Trigger OVR calculation
    exam = Examination.objects.get(id=1453)
    calculate_student_overall_result(exam, s)

    ovr = StudentOverallResult.objects.get(examination=exam, student=s)
    print(f"OVR -> Obtained: {ovr.total_marks_obtained}, GPA: {ovr.cgpa}, Rank: {ovr.rank}, Failed: {ovr.failed_subjects_list}")

if __name__ == "__main__":
    run()
