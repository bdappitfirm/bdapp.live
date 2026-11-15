import os, sys, django
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.conf import settings
if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS = list(settings.ALLOWED_HOSTS) + ['testserver']

from rest_framework.test import APIRequestFactory, force_authenticate
from results.views import StudentOverallResultViewSet
from users.models import User
from academics.models import StudentProfile

# find a user attached to school 63 (the student's school)
stu = StudentProfile.objects.get(id=7294)
school_id = stu.classroom.school_id
print("school_id:", school_id)
u = User.objects.filter(profile__school_id=school_id).first()
print("user:", u, getattr(getattr(u, 'profile', None), 'school_id', None), getattr(getattr(u, 'profile', None), 'role', None))
assert u is not None, "no user found for school"

factory = APIRequestFactory()
view = StudentOverallResultViewSet.as_view({'get': 'list'})

req = factory.get('/api/results/overall/', {'student': '7294', 'examination': '1645'})
force_authenticate(req, user=u)
resp = view(req)
resp.render()
data = resp.data if hasattr(resp, 'data') else resp
print("status:", resp.status_code)
rows = list(data) if not isinstance(data, dict) else data.get('results', [])
print("rows:", len(rows))
for o in rows:
    s = o.get('student') or {}
    sid = s.get('id') if isinstance(s, dict) else s
    print(f"  ov={o.get('id')} student_id={sid} total={o.get('total_marks_obtained')} cgpa={o.get('cgpa')} grade={o.get('grade')}")
