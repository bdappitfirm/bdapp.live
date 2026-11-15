import os, sys, django, json
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS = list(settings.ALLOWED_HOSTS) + ['testserver']

from rest_framework.test import APIClient
from users.models import AdminProfile

prof = AdminProfile.objects.filter(school_id=19).select_related('user').first()
print('admin user:', prof.user_id if prof else None, prof.user.username if prof and prof.user else None)
u = prof.user

c = APIClient()
c.force_authenticate(user=u)

for url in [
    '/api/results/examinations/?classroom=133&page_size=100&school=19',
    '/api/results/examinations/?classroom=133&page_size=100',
]:
    r = c.get(url)
    print('\nGET', url, '->', r.status_code)
    data = r.data
    items = data if isinstance(data, list) else data.get('results', [])
    print('  count:', len(items))
    for it in items:
        print('   keys:', sorted(it.keys()))
        print('   sample:', json.dumps({k: it.get(k) for k in ('id', 'name', 'exam_type', 'year', 'academic_year', 'classroom', 'exam_date')}, ensure_ascii=False, default=str))
        break

r = c.get('/api/results/results/?examination=1689&student=2126&page_size=1000&school=19')
print('\nGET results exam=1689 student=2126 ->', r.status_code)
d = r.data
arr = d if isinstance(d, list) else d.get('results', [])
print('  count:', len(arr), 'total count field:', None if isinstance(d, list) else d.get('count'))
for it in arr:
    print('   ', json.dumps({k: it.get(k) for k in ('id', 'examination', 'student', 'subject', 'written_marks', 'mcq_marks', 'total_obtained')}, ensure_ascii=False, default=str))
