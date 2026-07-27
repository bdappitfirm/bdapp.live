import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile
from results.models import Result

s = StudentProfile.objects.filter(roll_number='15', school_id=19).first()
if s:
    print(f"Student: {s.user.first_name} {s.user.last_name}, Class: {s.classroom.name if s.classroom else 'N/A'}")
    rs = Result.objects.filter(student=s)
    for r in rs:
        print(f"Sub: {r.subject.name}, W:{r.written_marks}, M:{r.mcq_marks}, P:{r.practical_marks}, T:{r.total_obtained}, Passed:{r.is_passed}")
else:
    print("No student found with Roll 15 in School 19")
