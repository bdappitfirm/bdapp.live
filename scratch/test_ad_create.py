import os
import django
import sys

sys.stdout.reconfigure(encoding='utf-8')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.serializers import AdvertisementSerializer
from django.core.files.uploadedfile import SimpleUploadedFile
from schools.models import School

school = School.objects.first()
print("Using school:", school)

file_data = SimpleUploadedFile("test_video.mp4", b"fake video content bytes", content_type="video/mp4")

data = {
    'text': 'Test Ad',
    'link': 'https://example.com',
    'type': 'video',
    'slot': 'slot1',
    'school': school.id if school else '',
    'media': file_data
}

serializer = AdvertisementSerializer(data=data)
if serializer.is_valid():
    ad = serializer.save()
    print("Successfully created ad:", ad.id)
else:
    print("Validation errors:", serializer.errors)
