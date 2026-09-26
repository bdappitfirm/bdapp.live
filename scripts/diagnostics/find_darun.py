import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile
from results.models import Result

ss = StudentProfile.objects.filter(user__first_name='দারুন', user__last_name='ত্রিপুরা', school_id=62)
for s in ss:
    print(f"--- Student ID: {s.id}, Roll: {s.roll_number}, Class: {s.classroom.name if s.classroom else 'N/A'} ---")
    rs = Result.objects.filter(student=s).select_related('subject', 'examination')
    for r in rs:
        print(f"  [{r.examination.name}] {r.subject.name}: W:{r.written_marks}, M:{r.mcq_marks}, P:{r.practical_marks}, T:{r.total_obtained}, Passed:{r.is_passed}, Grade:{r.grade}")
