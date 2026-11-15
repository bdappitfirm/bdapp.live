import os, sys, django
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile
from results.models import Result, StudentOverallResult
from django.db.models import Q

def full(s):
    u = s.user
    return f"{getattr(u,'first_name','')} {getattr(u,'last_name','')}".strip()

print('=== match father/mother ===')
qs = StudentProfile.objects.filter(
    Q(father_name__icontains='ALAMGIR') | Q(mother_name__icontains='HASINA BEGUM') |
    Q(father_name__icontains='PATWARY') | Q(father_name__icontains='PATWARI')
)
for s in qs:
    print(f'id={s.id} name={full(s)!r} class={getattr(s.classroom,"name",None)!r} sec={getattr(s.section,"name",None)!r} roll={s.roll_number} group={s.student_group!r} father={s.father_name!r} mother={s.mother_name!r} school={getattr(s.school,"name",None)!r}')

print()
print('=== overall totals near 857 ===')
for o in StudentOverallResult.objects.filter(total_marks_obtained__gte=840, total_marks_obtained__lte=875).select_related('student','student__user','examination'):
    s = o.student
    print(f'id={o.id} student={s.id} name={full(s)!r} class={getattr(s.classroom,"name",None)!r} group={s.student_group!r} exam={o.examination_id} {getattr(o.examination,"name",None)!r} total={o.total_marks_obtained} cgpa={o.cgpa} passed={o.is_passed}')
