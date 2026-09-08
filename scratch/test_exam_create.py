import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.serializers import ExaminationSerializer
from schools.models import School
from academics.models import ClassRoom

def test():
    school = School.objects.first()
    classroom = ClassRoom.objects.filter(school=school).first()

    data = {
        'name': 'Midterm-2',
        'exam_type': 'half_yearly',
        'classroom': classroom.id,
        'school': school.id,
        'total_marks': 100,
        'pass_marks': 33,
        'exam_date': '2026-09-13'
    }

    serializer = ExaminationSerializer(data=data)
    if serializer.is_valid():
        print("Valid!")
    else:
        print("Errors:", serializer.errors)

if __name__ == '__main__':
    test()
