import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result
from results.utils import _class_group, get_subject_maxima

# Fetch all results to re-evaluate
rs = Result.objects.all().select_related('student__classroom', 'subject')
count = 0
for r in rs:
    if not r.student.classroom:
        continue

    group = _class_group(r.student.classroom.name)
    if not group:
        continue

    # Force a save which triggers the recalculation logic in Result.save()
    # Result.save() calls get_subject_maxima internally
    old_passed = r.is_passed
    old_grade = r.grade
    r.save()

    if r.is_passed != old_passed or r.grade != old_grade:
        count += 1

print(f"Successfully re-evaluated and updated {count} results based on new criteria.")
