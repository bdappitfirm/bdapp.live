import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile
from results.models import Result

students = StudentProfile.objects.filter(user__first_name='আরাফাত', user__last_name='সানি')
for s in students:
    print(f"ID: {s.id}, Name: {s.user.first_name} {s.user.last_name}, School: {s.school.name}, Roll: {s.roll_number}, Class: {s.classroom.name if s.classroom else 'N/A'}")
    rs = Result.objects.filter(student=s)
    for r in rs:
        print(f"  Sub: {r.subject.name}, W:{r.written_marks}, M:{r.mcq_marks}, P:{r.practical_marks}, T:{r.total_obtained}, Passed:{r.is_passed}")
