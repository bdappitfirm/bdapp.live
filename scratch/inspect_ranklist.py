import os, sys, django
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile
from results.models import StudentOverallResult, Examination

def full(s):
    u = s.user
    return f"{getattr(u,'first_name','')} {getattr(u,'last_name','')}".strip()

print('=== all overalls for student 7294 ===')
for o in StudentOverallResult.objects.filter(student_id=7294):
    print(f'  exam={o.examination_id} {getattr(o.examination,"name",None)!r} type={getattr(o.examination,"exam_type",None)} class={getattr(o.examination.classroom,"name",None)} total={o.total_marks_obtained} cgpa={o.cgpa} passed={o.is_passed}')

print()
print('=== rank list query: exam_type=half_yearly, classroom=272, section=306 ===')
qs = StudentOverallResult.objects.filter(
    examination__exam_type='half_yearly',
    examination__classroom_id=272,
    student__section_id=306,
).select_related('student','examination')
for o in qs:
    s = o.student
    print(f'  sid={s.id} {full(s)!r} exam={o.examination_id} total={o.total_marks_obtained} cgpa={o.cgpa} passed={o.is_passed}')

print()
print('=== which half_yearly exams exist for classroom 272 ===')
for e in Examination.objects.filter(classroom_id=272, exam_type='half_yearly'):
    print(f'  exam={e.id} name={e.name!r} year={getattr(e,"year",None)} date={getattr(e,"exam_date",None)}')

print()
print('=== rank list WITHOUT section filter (classroom 272, half_yearly) count & any 857 ===')
qs2 = StudentOverallResult.objects.filter(examination__exam_type='half_yearly', examination__classroom_id=272).select_related('student')
print('count', qs2.count())
for o in qs2.filter(total_marks_obtained__gte=850):
    print(f'  sid={o.student_id} {full(o.student)!r} exam={o.examination_id} total={o.total_marks_obtained}')
