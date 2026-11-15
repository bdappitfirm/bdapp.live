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
cid = s7466.classroom_id
print(f'classroom id={cid} name={getattr(s7466.classroom,"name",None)!r} school={s7466.school_id}')

print()
print('=== roll == 1 in this classroom ===')
for s in StudentProfile.objects.filter(classroom_id=cid, roll_number='1'):
    rc = Result.objects.filter(student=s).count()
    print(f'  id={s.id} name={full(s)!r} sec_id={s.section_id} sec={getattr(s.section,"name",None)!r} roll={s.roll_number!r} group={s.student_group!r} father={s.father_name!r} mother={s.mother_name!r} results={rc}')

print()
print('=== sections (distinct) referenced in this classroom ===')
seen = {}
for s in StudentProfile.objects.filter(classroom_id=cid):
    key = (s.section_id, getattr(s.section,'name',None))
    seen[key] = seen.get(key,0)+1
for k,v in seen.items():
    print(f'  section_id={k[0]} name={k[1]!r} count={v}')

print()
print('=== students with section name like Humanities/মানবিক in this classroom ===')
for s in StudentProfile.objects.filter(classroom_id=cid).filter(Q(section__name__icontains='Human')|Q(section__name__icontains='মানবিক')|Q(section__name__icontains='Arts')):
    rc = Result.objects.filter(student=s).count()
    print(f'  id={s.id} name={full(s)!r} sec_id={s.section_id} sec={getattr(s.section,"name",None)!r} roll={s.roll_number!r} group={s.student_group!r} results={rc}')

print()
print('=== OverallResult rows for exam 1645 in this classroom ===')
for o in StudentOverallResult.objects.filter(student__classroom_id=cid, examination_id=1645).select_related('student'):
    s=o.student
    print(f'  sid={s.id} name={full(s)!r} sec={getattr(s.section,"name",None)!r} roll={s.roll_number!r} group={s.student_group!r} total={o.total_marks_obtained} cgpa={o.cgpa} passed={o.is_passed}')
