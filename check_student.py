import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile
from results.models import Result

students = StudentProfile.objects.filter(roll_number='15', classroom__name__icontains='সপ্তম')
for s in students:
    print(f"--- Student: {s.user.first_name} {s.user.last_name}, School: {s.school.name} ---")
    results = Result.objects.filter(student=s, subject__name__icontains='কৃষি')
    if not results:
        results = Result.objects.filter(student=s, subject__name__icontains='গার্হস্থ্য')

    if not results:
        # Check all results for this student to see if Agriculture is named differently
        results = Result.objects.filter(student=s)

    for r in results:
        print(f"Sub: {r.subject.name}, W:{r.written_marks}, M:{r.mcq_marks}, P:{r.practical_marks}, T:{r.total_obtained}, Passed:{r.is_passed}, GPA:{r.gpa}")
