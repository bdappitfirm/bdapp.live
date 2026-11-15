import os, sys, django
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result

print("=== raw Result rows for student 7294, exam 1645 ===")
qs = Result.objects.filter(student_id=7294, examination_id=1645).select_related('subject').order_by('id')
for r in qs:
    print(f"  rid={r.id} subj_id={r.subject_id} name={(r.subject.name if r.subject else None)!r} "
          f"written={r.written_marks!r} mcq={r.mcq_marks!r} pr={r.practical_marks!r} total={r.total_obtained!r}")
print("count:", qs.count())

from academics.models import StudentProfile
s = StudentProfile.objects.select_related('classroom', 'section', 'user').get(id=7294)
print("\nstudent 7294:", s.user.first_name, s.user.last_name, "group=", s.student_group,
      "section=", getattr(s.section, 'name', None), "section_id=", s.section_id,
      "optional_subject=", getattr(s, 'optional_subject_id', None))
