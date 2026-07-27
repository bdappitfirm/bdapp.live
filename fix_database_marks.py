import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Examination, Result
from results.utils import _class_group, get_subject_maxima
from decimal import Decimal

def fix_all_marks():
    print("Starting database audit and fix...")

    # 0. Fix School Names and Addresses
    from schools.models import School
    target_schools = School.objects.filter(name__icontains='দ্বারকানাথ')
    for sch in target_schools:
        changed = False
        if '(ডিএন)' in sch.name or 'উচ্চ বিদ্যালয়' in sch.name:
            sch.name = 'দ্বারকানাথ (ডি.এন.) হাই স্কুল'
            changed = True

        # Add road name if missing
        if sch.address and 'হাজী মহসিন রোড' not in sch.address:
            sch.address = 'হাজী মহসিন রোড, ' + sch.address
            changed = True
        elif not sch.address:
            sch.address = 'হাজী মহসিন রোড, লক্ষ্মীপুর'
            changed = True

        if changed:
            sch.save()
            print(f"Updated school info for: {sch.name}")

    # 1. Fix Examination records
    exams = Examination.objects.all()
    exam_fixes = 0
    for exam in exams:
        group = _class_group(exam.classroom.name)
        # We need a subject to get maxima, but here we can check if it's a paper-based exam
        name = exam.name.lower()
        if group == 'six_to_eight':
            if any(k in name for k in ['২য়', '২য়', '2nd', 'second', 'ict', 'আইসিটি']):
                if exam.total_marks == 100:
                    exam.total_marks = 50
                    # Also fix components if they are set
                    if exam.written_max == 70: exam.written_max = 35
                    if exam.mcq_max == 30: exam.mcq_max = 15
                    exam.save()
                    exam_fixes += 1

    print(f"Fixed {exam_fixes} Examination records.")

    # 2. Fix Individual Results and trigger recalculation
    results = Result.objects.all().select_related('examination', 'examination__classroom', 'subject')
    result_fixes = 0
    for res in results:
        # Trigger the save() method which contains our new accurate logic
        old_grade = res.grade
        old_gpa = res.gpa
        res.save() # This recalculates everything based on updated utils.py

        if res.grade != old_grade or res.gpa != old_gpa:
            result_fixes += 1

    print(f"Recalculated and fixed {result_fixes} Result entries.")

    # 3. Fix Overall Results and populate academic_year
    from results.models import StudentOverallResult
    from results.signals import calculate_student_overall_result

    overalls = StudentOverallResult.objects.all()
    overall_count = overalls.count()
    print(f"Recalculating {overall_count} overall results...")

    fixed_overalls = 0
    for ovr in overalls:
        calculate_student_overall_result(ovr.examination, ovr.student)
        fixed_overalls += 1

    print(f"Successfully recalculated {fixed_overalls} overall results.")
    print("Database audit completed successfully.")

if __name__ == "__main__":
    fix_all_marks()
