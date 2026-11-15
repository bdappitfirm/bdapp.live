import os, sys, django
from collections import Counter
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result
from django.db.models import Count

qs = Result.objects.filter(examination_id=1689)
print('total rows exam 1689:', qs.count(), 'distinct students:', qs.values('student').distinct().count())

cnt = Counter(qs.values_list('student', flat=True))
dist = Counter(cnt.values())
print('rows-per-student distribution:', dict(sorted(dist.items())))

print('\nstudent 2126 rows:', cnt.get(2126))

print('\nsubjects present in exam 1689 (name: rows):')
for row in qs.values('subject__name').annotate(c=Count('id')).order_by('-c'):
    print('   ', row['subject__name'], row['c'])

print('\nsample peers in class 133 with more rows:')
peers = [s for s in qs.filter(student__classroom_id=133).values_list('student', flat=True)]
pc = Counter(peers)
for sid, c in pc.most_common(8):
    print('   student', sid, 'rows', c)
