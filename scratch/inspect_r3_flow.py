import os, sys, django
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile
from results.models import Result, StudentOverallResult, Examination
from results.serializers import StudentOverallResultSerializer
from django.db.models import Q

def full(s):
    u = s.user
    return f"{getattr(u,'first_name','')} {getattr(u,'last_name','')}".strip()

print("=== students named like SADIYA / ছাদিয়া ===")
q = StudentProfile.objects.filter(
    Q(user__first_name__icontains='sadiya') | Q(user__last_name__icontains='sadiya') |
    Q(user__first_name__icontains='সাদিয়া') | Q(user__last_name__icontains='সাদিয়া') |
    Q(user__first_name__icontains='ছাদিয়া') | Q(user__last_name__icontains='ছাদিয়া')
)
for s in q:
    print(f"  id={s.id} name={full(s)!r} cls={getattr(s.classroom,'name',None)!r} sec_id={s.section_id} sec={getattr(s.section,'name',None)!r} roll={s.roll_number!r} group={s.student_group!r} father={s.father_name!r}")

print()
print("=== classroom 272 (Ten) students with roll & section ===")
for s in StudentProfile.objects.filter(classroom_id=272).order_by('section_id','roll_number'):
    print(f"  id={s.id} name={full(s)!r} sec_id={s.section_id} sec={getattr(s.section,'name',None)!r} roll={s.roll_number!r} group={s.student_group!r}")

print()
print("=== overall rows for exam 1645 in classroom 272 ===")
for o in StudentOverallResult.objects.filter(examination_id=1645, student__classroom_id=272).select_related('student','examination'):
    s = o.student
    print(f"  stu={s.id} {full(s)!r} sec={getattr(s.section,'name',None)!r} total={o.total_marks_obtained} poss={o.total_marks_possible} cgpa={o.cgpa} grade={o.grade} passed={o.is_passed}")

print()
print("=== serializer fields for one overall row ===")
o = StudentOverallResult.objects.filter(examination_id=1645, student__classroom_id=272).first()
data = StudentOverallResultSerializer(o).data
print("KEYS:", list(data.keys()))
print("student field type:", type(data.get('student')), data.get('student'))
print("full data:", data)
