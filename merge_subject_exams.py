import os
import django
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Examination, Result, StudentOverallResult
from results.signals import calculate_student_overall_result, calculate_ranks
from academics.models import StudentProfile

def merge_exams_for_school(school_id):
    print(f"\nProcessing School ID: {school_id}")

    # Common main exam keywords (Ordered by priority)
    main_keywords = ['অর্ধ-বার্ষিক', 'অর্ধ বার্ষিক', 'half yearly', 'annual', 'বার্ষিক', 'terminal', 'প্রাক নির্বাচনী', 'pre-test', 'test']

    # Get all distinct classroom and year combinations
    class_years = Examination.objects.filter(school_id=school_id).values_list('classroom_id', 'year').distinct()

    for classroom_id, year in class_years:
        if year is None: continue

        all_exams = list(Examination.objects.filter(school_id=school_id, classroom_id=classroom_id, year=year))
        if len(all_exams) <= 1: continue

        print(f"  Classroom ID: {classroom_id}, Year: {year}")

        # 1. Identify the Target (Main) Exam
        target_exam = None

        # Try to find an exam that sounds like a full term exam
        for keyword in main_keywords:
            for e in all_exams:
                if keyword.lower() in e.name.lower():
                    target_exam = e
                    break
            if target_exam: break

        # Fallback: Pick the one with the MOST subjects already in it
        if not target_exam:
            target_exam = max(all_exams, key=lambda e: e.results.values('subject_id').distinct().count())

        print(f"    Target Exam: {target_exam.name} (ID: {target_exam.id})")

        # 2. Merge all other exams for this class/year into the Target
        others = [e for e in all_exams if e.id != target_exam.id]

        total_moved = 0
        total_deleted_exams = 0

        for source_exam in others:
            source_results = Result.objects.filter(examination=source_exam)
            for r in source_results:
                # Check for existing result for this student and subject in target
                existing = Result.objects.filter(
                    examination=target_exam,
                    student_id=r.student_id,
                    subject_id=r.subject_id
                ).first()

                if existing:
                    # If target has no marks but source has, update target
                    source_has_marks = (r.written_marks is not None or r.mcq_marks is not None or r.practical_marks is not None)
                    target_has_marks = (existing.written_marks is not None or existing.mcq_marks is not None or existing.practical_marks is not None)

                    if source_has_marks and not target_has_marks:
                        existing.written_marks = r.written_marks
                        existing.mcq_marks = r.mcq_marks
                        existing.practical_marks = r.practical_marks
                        existing.save()
                    elif source_has_marks and target_has_marks:
                        # Both have marks, keep the one with higher total
                        r_total = (float(r.written_marks or 0) + float(r.mcq_marks or 0) + float(r.practical_marks or 0))
                        e_total = (float(existing.written_marks or 0) + float(existing.mcq_marks or 0) + float(existing.practical_marks or 0))
                        if r_total > e_total:
                            existing.written_marks = r.written_marks
                            existing.mcq_marks = r.mcq_marks
                            existing.practical_marks = r.practical_marks
                            existing.save()
                    r.delete()
                else:
                    # No existing result in target, move this one
                    r.examination = target_exam
                    r.save()
                    total_moved += 1

            # Clean up empty exam object
            if source_exam.results.count() == 0:
                source_exam.delete()
                total_deleted_exams += 1

        print(f"    Merged {total_moved} results from {total_deleted_exams} subject-exams.")

        # 3. Comprehensive Recalculation for Target Exam
        # First ensure individual results are correct
        for r in Result.objects.filter(examination=target_exam).iterator():
            r.save()

        # Then calculate overall results for all students in the class
        students = StudentProfile.objects.filter(classroom_id=classroom_id, school_id=school_id)
        print(f"    Recalculating merit list for {students.count()} students...")
        for s in students:
            calculate_student_overall_result(target_exam, s)

        # Finally calculate ranks
        calculate_ranks(target_exam)

def run():
    # Fetch all schools that have results
    from schools.models import School
    school_ids = Result.objects.values_list('examination__school_id', flat=True).distinct()
    for sid in school_ids:
        if sid:
            merge_exams_for_school(sid)
    print("\n[SUCCESS] All merges and recalculations complete.")

if __name__ == "__main__":
    run()
