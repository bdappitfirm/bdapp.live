import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from users.models import Profile
from users.serializers import TeacherProfileSerializer
p = Profile.objects.filter(role='teacher').first()
print('prof', p.id if p else None, p.user.username if p else 'none')
data = {'password': 'Test1234'}
s = TeacherProfileSerializer(instance=p, data=data, partial=True)
print('valid', s.is_valid())
print('errors', s.errors)
if s.is_valid():
    obj = s.save()
    print('saved', obj.user.check_password('Test1234'))
