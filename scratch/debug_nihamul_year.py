import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from academics.models import StudentProfile
from results.models import Result

def debug():
    school = School.objects.get(id=19)
    student = StudentProfile.objects.get(pk=2476)
    results = Result.objects.filter(student=student)
    for r in results:
        print(f"Exam: {r.examination.name}, Year: {r.examination.year}, Academic Year: {getattr(r, 'academic_year', 'N/A')}, Subject: {r.subject.name}, Obtained: {r.total_obtained}")

if __name__ == '__main__':
    debug()
