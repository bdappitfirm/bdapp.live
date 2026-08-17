import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Examination, Result, StudentOverallResult
from results.signals import calculate_student_overall_result
from academics.models import StudentProfile

def run():
    # Rumana Akter Roll 2 Section G Class 6 school 19
    s = StudentProfile.objects.filter(school_id=19, classroom__name__icontains='ষষ্ঠ', roll_number='2', section__name__icontains='গ').first()
    if not s:
        print("Rumana not found")
        return

    print(f"Found student: {s.user.get_full_name()} (ID: {s.id})")

    exam = Examination.objects.get(id=1535)
    print(f"Exam: {exam.name} (ID: {exam.id})")

    results = Result.objects.filter(examination=exam, student=s)
    print(f"Results count: {results.count()}")
    for r in results:
        print(f"  - {r.subject.name}: {r.total_obtained}")

    print("Recalculating overall result...")
    calculate_student_overall_result(exam, s)

    ovr = StudentOverallResult.objects.get(examination=exam, student=s)
    print(f"Overall Result -> Obtained: {ovr.total_marks_obtained}, GPA: {ovr.cgpa}, Rank: {ovr.rank}")

if __name__ == "__main__":
    run()
