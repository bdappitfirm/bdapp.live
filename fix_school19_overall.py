import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result, StudentOverallResult
from results.signals import calculate_student_overall_result
from results.utils import _class_group

def fix_school19():
    print("Recalculating all primary StudentOverallResults for school 19...")
    sors = StudentOverallResult.objects.filter(examination__school_id=19).select_related('examination__classroom', 'student')
    count = 0
    for sor in sors.iterator():
        cls_name = getattr(sor.examination.classroom, 'name', None) if sor.examination and sor.examination.classroom else None
        if _class_group(cls_name) == 'primary':
            calculate_student_overall_result(sor.examination, sor.student)
            count += 1
    print(f"Recalculated {count} overall results for school 19.")

if __name__ == '__main__':
    fix_school19()
