import os, sys, django
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile
from results.models import Result, StudentOverallResult

s = StudentProfile.objects.get(id=7294)
print('student', s.id, 'sec', getattr(s.section,'name',None), 'sec_id', s.section_id, 'roll', s.roll_number, 'group', s.student_group, 'optional', getattr(s.optional_subject,'name',None), getattr(s.optional_subject,'id',None))
print('classroom', s.classroom_id, getattr(s.classroom,'name',None))

print()
print('=== results (all exams) ===')
for r in Result.objects.filter(student=s).order_by('examination_id','id'):
    print(f"  rid={r.id} exam={r.examination_id} subj_id={r.subject_id} subj={r.subject.name!r} cq={r.written_marks!r} mcq={r.mcq_marks!r} pr={r.practical_marks!r} total={r.total_obtained!r} grade={getattr(r,'grade',None)!r} gpa={getattr(r,'gpa',None)!r}")

print()
print('=== overall for 7294 ===')
for o in StudentOverallResult.objects.filter(student=s):
    print(f"  ov_id={o.id} exam={o.examination_id} {getattr(o.examination,'name',None)!r} total={o.total_marks_obtained} poss={o.total_marks_possible} cgpa={o.cgpa} grade={o.grade} passed={o.is_passed}")

print()
print('=== section 306 students overall exam 1645 ===')
for o in StudentOverallResult.objects.filter(examination_id=1645, student__section_id=306).select_related('student'):
    print(f"  stu={o.student_id} roll={o.student.roll_number!r} total={o.total_marks_obtained} cgpa={o.cgpa} passed={o.is_passed}")
