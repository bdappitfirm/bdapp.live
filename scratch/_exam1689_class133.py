import os, sys, django
from collections import Counter, defaultdict
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result

qs = Result.objects.filter(examination_id=1689, student__classroom_id=133).select_related('subject')

by_student = defaultdict(list)
for r in qs:
    by_student[r.student_id].append(r)

print('class 133 students in exam 1689:', len(by_student))

def has_marks(r):
    for f in ('written_marks', 'mcq_marks', 'practical_marks'):
        v = getattr(r, f)
        if v is not None and float(v) > 0:
            return True
    return float(r.total_obtained or 0) > 0

print('\nper-student subject rows / rows-with-marks:')
for sid in sorted(by_student):
    rows = by_student[sid]
    withm = [r for r in rows if has_marks(r)]
    names = ','.join(sorted(f"{r.subject.name}" for r in withm))
    flag = '   <== OUR STUDENT' if sid == 2126 else ''
    print(f'  {sid}: rows={len(rows)} marks-rows={len(withm)} [{names}]{flag}')

print('\naggregate: how many students with X rows-with-marks')
print(Counter(len([r for r in rs if has_marks(r)]) for rs in by_student.values()))
