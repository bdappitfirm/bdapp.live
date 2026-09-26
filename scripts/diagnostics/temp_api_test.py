import os
import django
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import User, Profile
from rest_framework_simplejwt.tokens import RefreshToken

admin = User.objects.filter(username='admin_test').first() or User.objects.filter(is_superuser=True).first()
if not admin:
    raise SystemExit('Admin user not found')

refresh = RefreshToken.for_user(admin)
token = str(refresh.access_token)

profile = Profile.objects.filter(role='teacher').first()
if not profile:
    raise SystemExit('Teacher profile not found')

url = f'http://127.0.0.1:8000/api/users/teachers/{profile.id}/'
print('URL', url)

files = {'password': (None, 'LiveTest123')}
headers = {'Authorization': f'Bearer {token}'}
resp = requests.patch(url, files=files, headers=headers)
print('status', resp.status_code)
print('text', resp.text)
