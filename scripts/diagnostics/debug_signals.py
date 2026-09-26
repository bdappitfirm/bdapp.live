import os
import django
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Examination, Result, StudentOverallResult
from academics.models import StudentProfile

def debug_calculate(examination, student):
    all_results = Result.objects.filter(examination=examination, student=student)
    print(f"DEBUG: all_results count: {all_results.count()}")

    student_group = (student.student_group or "").lower()
    from results.utils import _class_group
    is_910 = _class_group(getattr(examination.classroom, "name", None)) == 'nine_ten'
    print(f"DEBUG: is_910: {is_910}, student_group: {student_group}")

    best_results = {}
    for r in all_results:
        name = r.subject.name.lower()
        norm_key = re.sub(r'\s*\(.*?\)\s*', '', name).strip()
        print(f"DEBUG: Processing {name} -> norm_key: {norm_key}, marks: {r.total_obtained}")
        if norm_key not in best_results or float(r.total_obtained) > float(best_results[norm_key].total_obtained):
            best_results[norm_key] = r

    results_to_process = list(best_results.values())
    print(f"DEBUG: results_to_process count: {len(results_to_process)}")

    EXCLUDED_SUBJECTS = ['শারীরিক শিক্ষা ও স্বাস্থ্য', 'শারীরিক শিক্ষা', 'physical education', 'ক্যারিয়ার শিক্ষা', 'career education', 'ক্যারিয়ার', 'word collection achievement test', 'wcat', 'বই পড়া', 'বই পড়া']
    main_results = []
    for r in results_to_process:
        subject_name = r.subject.name.lower().strip()
        is_excluded = any(ex in subject_name for ex in EXCLUDED_SUBJECTS)
        if is_excluded:
            print(f"DEBUG: Excluding {subject_name}")
            continue
        main_results.append(r)

    print(f"DEBUG: main_results count: {len(main_results)}")
    results_to_calculate = main_results if main_results else results_to_process
    print(f"DEBUG: results_to_calculate count: {len(results_to_calculate)}")

    total_obtained = sum(float(r.total_obtained) for r in results_to_calculate)
    print(f"DEBUG: total_obtained: {total_obtained}")

def run():
    # Rumana ID 2805, Exam 1535
    s = StudentProfile.objects.get(id=2805)
    e = Examination.objects.get(id=1535)
    debug_calculate(e, s)

if __name__ == "__main__":
    run()
