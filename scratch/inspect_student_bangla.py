import os, sys, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from results.models import Result, Examination

e = Examination.objects.get(id=1541)
rs = Result.objects.filter(examination=e).select_related('subject', 'student__user')
# group by student for first 5 students that have Bangla results
cnt = 0
stu_ids = []
for r in rs:
    if 'বাংলা' in (r.subject.name or ''):
        if r.student_id not in stu_ids:
            stu_ids.append(r.student_id)
for sid in stu_ids[:6]:
    print('--- student', sid)
    for r in rs.filter(student_id=sid):
        print('   ', repr(r.subject.name), 'w=', r.written_marks, 'm=', r.mcq_marks, 'p=', r.practical_marks, 'tot=', r.total_obtained, 'grade=', r.grade, 'pass=', r.is_passed)
