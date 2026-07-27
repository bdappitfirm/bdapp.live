import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile
from results.models import Result, Examination

s = StudentProfile.objects.filter(user__first_name='আরাফাত', user__last_name='সানি', school__id=62).first()
if s:
    print(f"Student: {s.user.get_full_name()}, ID: {s.id}")
    # Find all exams for this student
    rs = Result.objects.filter(student=s).select_related('examination', 'subject')
    for r in rs:
        print(f"Exam: {r.examination.name} (ID:{r.examination_id}), Sub: {r.subject.name}, T:{r.total_obtained}")
else:
    print("Student not found")
