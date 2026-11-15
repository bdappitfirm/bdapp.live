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

print("=== match father ALAMGIR/PATWARY or mother HASINA ===")
qs = StudentProfile.objects.filter(
    Q(father_name__icontains='আলমগীর') | Q(father_name__icontains='পাটওয়ারী') | Q(father_name__icontains='পাটোয়ারী') |
    Q(father_name__icontains='alamgir') | Q(father_name__icontains='patwary') |
    Q(mother_name__icontains='হাসিনা') | Q(mother_name__icontains='হাছিনা') | Q(mother_name__icontains='hasina')
)
for s in qs.select_related('classroom','section','user'):
    print(f"  id={s.id} name={full(s)!r} cls={getattr(s.classroom,'name',None)!r} sec={getattr(s.section,'name',None)!r} roll={s.roll_number!r} group={s.student_group!r} father={s.father_name!r} mother={s.mother_name!r}")

print()
print("=== overall rows total 850-860 ===")
for o in StudentOverallResult.objects.filter(total_marks_obtained__gte=850, total_marks_obtained__lte=860).select_related('student','examination'):
    s = o.student
    print(f"  ov_id={o.id} stu={s.id} {full(s)!r} cls={getattr(s.classroom,'name',None)!r} sec={getattr(s.section,'name',None)!r} roll={s.roll_number!r} group={s.student_group!r} exam={o.examination_id} {getattr(o.examination,'name',None)!r} total={o.total_marks_obtained} cgpa={o.cgpa} grade={o.grade} passed={o.is_passed}")
