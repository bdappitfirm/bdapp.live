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

s7466 = StudentProfile.objects.get(id=7466)
sc = s7466.school
print(f'school of 7466 = id={sc.id} name={sc.name!r}')
print(f'7466 classroom id={s7466.classroom_id} name={getattr(s7466.classroom,"name",None)!r} section id={s7466.section_id} name={getattr(s7466.section,"name",None)!r}')

print()
print('=== all students in same classroom as 7466 ===')
for s in StudentProfile.objects.filter(classroom_id=s7466.classroom_id).order_by('roll_number'):
    rc = Result.objects.filter(student=s).count()
    print(f'  id={s.id} name={full(s)!r} sec={getattr(s.section,"name",None)!r} roll={s.roll_number} group={s.student_group!r} optional={getattr(s.optional_subject,"name",None)!r} results={rc}')

print()
print('=== SADIYA in same school ===')
for s in StudentProfile.objects.filter(school_id=sc.id).filter(Q(user__first_name__icontains='SAD')|Q(user__last_name__icontains='SAD')|Q(user__first_name__icontains='PATWARY')):
    print(f'  id={s.id} name={full(s)!r} class={getattr(s.classroom,"name",None)!r} sec={getattr(s.section,"name",None)!r} roll={s.roll_number} group={s.student_group!r} father={s.father_name!r} mother={s.mother_name!r}')
