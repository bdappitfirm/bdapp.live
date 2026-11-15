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

qs = StudentProfile.objects.filter(Q(user__first_name__icontains='SADIYA') | Q(user__last_name__icontains='SADIYA') | Q(user__first_name__icontains='Sadia') | Q(user__last_name__icontains='Sadia'))
print('=== Students matching SADIYA ===')
for s in qs:
    print(f'id={s.id} name={full(s)!r} user={s.user_id} class={getattr(s.classroom,"name",None)!r} sec={getattr(s.section,"name",None)!r} roll={s.roll_number} group={s.student_group!r} optional={getattr(s.optional_subject,"name",None)!r} father={s.father_name!r} mother={s.mother_name!r} school={getattr(s.school,"name",None)!r}')

print()
for s in qs:
    print(f'--- student id={s.id} name={full(s)!r} ---')
    ovs = StudentOverallResult.objects.filter(student=s)
    for o in ovs:
        print(f'   OVERALL exam={o.examination_id} {getattr(o.examination,"name",None)!r} total={o.total_marks_obtained} cgpa={o.cgpa} passed={o.is_passed}')
    rs = Result.objects.filter(student=s)
    print(f'   results count={rs.count()}')
    tot = 0
    for r in rs:
        print(f'      id={r.id} exam={r.examination_id} subj={getattr(r.subject,"name",None)!r} cq={r.written_marks} mcq={r.mcq_marks} pr={r.practical_marks} total={r.total_obtained}')
        try:
            tot += float(r.total_obtained or 0)
        except Exception:
            pass
    print(f'   SUM of result totals = {tot}')
