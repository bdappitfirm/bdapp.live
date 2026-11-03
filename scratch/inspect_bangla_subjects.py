import os, sys, django
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from academics.models import Subject, ClassRoom
from results.models import Result, Examination

print('== all Bangla-ish subjects of school 19 ==')
for s in Subject.objects.filter(school_id=19).order_by('id'):
    if 'বাংলা' in (s.name or '') or 'bangla' in (s.name or '').lower():
        print(s.id, repr(s.name))

print('== distinct result subject names containing bangla across all schools ==')
seen = {}
for r in Result.objects.select_related('subject').all():
    n = r.subject.name if r.subject else None
    if n and ('বাংলা' in n or 'bangla' in n.lower()):
        seen.setdefault(n, 0)
        seen[n] += 1
for k, v in seen.items():
    print(repr(k), v)
