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

print('=== students in classroom name Ten with results ===')
for s in StudentProfile.objects.filter(classroom__name__icontains='Ten'):
    rc = Result.objects.filter(student=s).count()
    if rc:
        print(f'  student={s.id} {full(s)!r} class={getattr(s.classroom,"name",None)!r} sec={getattr(s.section,"name",None)!r} group={s.student_group!r} roll={s.roll_number} results={rc}')

print()
print('=== results with subject ICT/তথ্য and mcq 12 / practical 20 ===')
qs = Result.objects.filter(
    Q(subject__name__icontains='তথ্য') | Q(subject__name__icontains='ICT') | Q(subject__name__icontains='যোগাযোগ')
)
for r in qs.filter(mcq_marks='12')[:50]:
    s = r.student
    print(f'  rid={r.id} student={s.id} {full(s)!r} class={getattr(s.classroom,"name",None)!r} group={s.student_group!r} roll={s.roll_number} mcq={r.mcq_marks} pr={r.practical_marks} total={r.total_obtained} exam={r.examination_id}')

print()
print('=== students whose results include Bangla 1st with written 23 ===')
qs2 = Result.objects.filter(subject__name__icontains='বাংলা', written_marks='23')
for r in qs2[:80]:
    s = r.student
    print(f'  rid={r.id} subj={r.subject.name!r} student={s.id} {full(s)!r} class={getattr(s.classroom,"name",None)!r} group={s.student_group!r} roll={s.roll_number} exam={r.examination_id} cq={r.written_marks} mcq={r.mcq_marks} pr={r.practical_marks} total={r.total_obtained}')
