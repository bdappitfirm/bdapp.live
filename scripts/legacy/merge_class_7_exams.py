import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Examination, Result, StudentOverallResult
from results.signals import calculate_student_overall_result, calculate_ranks
from academics.models import StudentProfile

def run():
    source_id = 1536
    target_id = 1538

    print(f"Merging results from Exam {source_id} into {target_id}...")

    source_results = Result.objects.filter(examination_id=source_id)
    print(f"Found {source_results.count()} results in source exam.")

    moved_count = 0
    updated_count = 0

    for r in source_results:
        # Check if result already exists in target
        existing = Result.objects.filter(
            examination_id=target_id,
            student_id=r.student_id,
            subject_id=r.subject_id
        ).first()

        if existing:
            # Prefer the one with marks
            if (r.written_marks is not None or r.mcq_marks is not None) and (existing.written_marks is None and existing.mcq_marks is None):
                existing.written_marks = r.written_marks
                existing.mcq_marks = r.mcq_marks
                existing.practical_marks = r.practical_marks
                existing.save()
                updated_count += 1
            r.delete() # Remove duplicate from source
        else:
            r.examination_id = target_id
            r.save()
            moved_count += 1

    print(f"Moved {moved_count} results, Updated {updated_count} results.")

    # Recalculate everything for target exam
    exam = Examination.objects.get(id=target_id)
    # Get all students in the classroom
    students = StudentProfile.objects.filter(classroom=exam.classroom, school_id=19)
    print(f"Recalculating overall results for {students.count()} students in Class 7...")
    for s in students:
        calculate_student_overall_result(exam, s)

    calculate_ranks(exam)

    # Delete the empty source exam to avoid future confusion
    if Result.objects.filter(examination_id=source_id).count() == 0:
        print(f"Deleting empty source exam {source_id}...")
        Examination.objects.filter(id=source_id).delete()

    print("Merge and Recalculation Complete.")

if __name__ == "__main__":
    run()
