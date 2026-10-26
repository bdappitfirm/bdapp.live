import os
import django
import sys

sys.stdout.reconfigure(encoding='utf-8')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.test import Client
from schools.models import School
from users.models import User
from rest_framework_simplejwt.tokens import RefreshToken

client = Client(HTTP_HOST='127.0.0.1')
school = School.objects.first()
user = User.objects.filter(is_superuser=True).first() or User.objects.first()

refresh = RefreshToken.for_user(user)
access_token = str(refresh.access_token)

# Create a 90MB dummy video file buffer in memory
print("Creating 90MB test payload...")
dummy_video_data = b"0" * (90 * 1024 * 1024)

from django.core.files.uploadedfile import SimpleUploadedFile
file_obj = SimpleUploadedFile("large_test_video.mp4", dummy_video_data, content_type="video/mp4")

print("Sending POST request to /api/ads/...")
response = client.post('/api/ads/', {
    'text': 'Large Video Test Ad',
    'link': 'https://example.com',
    'type': 'video',
    'slot': 'slot1',
    'school': '',
    'school_ids': [str(school.id)] if school else [],
    'media': file_obj
}, HTTP_AUTHORIZATION=f'Bearer {access_token}')

print("Status code:", response.status_code)
print("Response content:", response.content.decode('utf-8'))
