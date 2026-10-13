import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import ClassRoom, StudentProfile

c10 = ClassRoom.objects.filter(id=211).first()
print('Classroom 211:', c10)
# Check if any student has ever had classroom_id = 211 in database or if it's completely 0
print('StudentProfile count with classroom_id=211:', StudentProfile.objects.filter(classroom_id=211).count())
