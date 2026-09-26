import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result, Examination, StudentOverallResult
from results.signals import calculate_student_overall_result, calculate_ranks
from results.utils import _class_group

def run():
    print("Fixing pass status for Continuous Assessment subjects (Book Reading, Physical Ed, Word Achievement)...")

    # Target subjects keywords
    keywords = ['book reading', 'বই পড়া', 'বই পড়া', 'physical education', 'শারীরিক শিক্ষা', 'word achievement', 'word collection', 'wcat']

    # Get all results for these subjects
    results = Result.objects.filter(
        models.Q(subject__name__icontains='book') |
        models.Q(subject__name__icontains='পড়া') |
        models.Q(subject__name__icontains='পড়া') |
        models.Q(subject__name__icontains='physical') |
        models.Q(subject__name__icontains='শারীরিক') |
        models.Q(subject__name__icontains='word') |
        models.Q(subject__name__icontains='wcat')
    )

    updated_exams = set()

    print(f"Checking {results.count()} records...")
    for r in results:
        # Save triggers the recalculation logic in models.py
        old_passed = r.is_passed
        old_grade = r.grade
        r.save()

        if old_passed != r.is_passed or old_grade != r.grade:
            print(f"  Updated: {r.student.user.get_full_name()} - {r.subject.name}: {r.total_obtained} ({old_grade} -> {r.grade})")
            updated_exams.add(r.examination)

    if updated_exams:
        print(f"\nRecalculating merit lists for {len(updated_exams)} examinations...")
        for exam in updated_exams:
            print(f"  Exam: {exam.name} (ID: {exam.id})")
            # Recalculate OVR for all students in this exam
            from academics.models import StudentProfile
            students = StudentProfile.objects.filter(classroom=exam.classroom, school=exam.school)
            for s in students:
                calculate_student_overall_result(exam, s)
            calculate_ranks(exam)

    print("\n[SUCCESS] CA subjects fixed.")

if __name__ == "__main__":
    from django.db import models
    run()
