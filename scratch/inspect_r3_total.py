import os, sys, django
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import Subject, StudentProfile
from results.models import Result, StudentOverallResult

s = StudentProfile.objects.select_related('optional_subject', 'classroom').get(id=7294)
print("student:", s.user.first_name, "optional_subject_id:", s.optional_subject_id,
      "optional_subject:", getattr(s.optional_subject, 'name', None))
print("classroom:", s.classroom.name if s.classroom else None)

subj1407 = Subject.objects.filter(id=1407).first()
print("subject 1407:", subj1407.name if subj1407 else None)

qs = Result.objects.filter(student_id=7294, examination_id=1645).select_related('subject').order_by('id')
total = 0
print("\n--- rows ---")
for r in qs:
    t = float(r.total_obtained or 0)
    total += t
    print(f"  subj={r.subject_id} {r.subject.name if r.subject else None} total={t} gpa={r.gpa}")
print("SUM of all result totals:", total)
print("count:", qs.count())

ov = StudentOverallResult.objects.filter(student_id=7294, examination_id=1645).first()
if ov:
    print("\n--- overall row ---")
    print("  id:", ov.id, "total_marks_obtained:", ov.total_marks_obtained,
          "total_marks_possible:", ov.total_marks_possible,
          "cgpa:", ov.cgpa, "grade:", ov.grade, "is_passed:", getattr(ov, 'is_passed', None),
          "updated_at:", getattr(ov, 'updated_at', None))
else:
    print("\nNO overall row")
