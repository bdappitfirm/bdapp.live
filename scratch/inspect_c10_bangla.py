import os, sys, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from results.models import Result, Examination
from academics.models import Subject

exams = Examination.objects.filter(school_id=19, classroom__name__icontains='দশম')
for e in exams:
    print('EXAM', e.id, e.name, e.exam_type, e.classroom.name, e.section and e.section.name, e.year)
print('---- subjects in results for these exams ----')
for e in exams:
    rs = Result.objects.filter(examination=e).select_related('subject', 'student')
    subs = {}
    for r in rs:
        subs.setdefault(r.subject.name, []).append(r)
    print('EXAM', e.id, e.name, 'results', rs.count())
    for name, lst in subs.items():
        r0 = lst[0]
        print('   ', repr(name), 'n=', len(lst), 'written=', r0.written_marks, 'mcq=', r0.mcq_marks, 'pr=', r0.practical_marks, 'total=', r0.total_obtained)
