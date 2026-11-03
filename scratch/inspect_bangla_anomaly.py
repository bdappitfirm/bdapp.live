import os, sys, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from results.models import Result

qs = Result.objects.select_related('subject', 'examination__classroom', 'examination__school').filter(subject__name__contains='বাংলা')
print('total bangla rows', qs.count())
for r in qs:
    n = r.subject.name
    if n in ('বাংলা',) or ('প্রথম' not in n and 'দ্বিতীয়' not in n and 'পত্র' not in n):
        print(r.examination.school_id, r.examination.classroom.name, r.examination.name, repr(n), 'w=', r.written_marks, 'm=', r.mcq_marks, 'p=', r.practical_marks)
print('--- high written (>70) bangla rows ---')
for r in qs:
    if r.written_marks is not None and float(r.written_marks) > 70:
        print(r.examination.school_id, r.examination.classroom.name, r.examination.name, repr(r.subject.name), 'w=', r.written_marks, 'm=', r.mcq_marks)
