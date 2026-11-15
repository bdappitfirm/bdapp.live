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
print('classroom', cid, getattr(s7466.classroom,'name',None))

cands = StudentProfile.objects.filter(classroom_id=cid, roll_number='1')
for s in cands:
    print(f'id={s.id} name={full(s)!r} sec_id={s.section_id} sec={getattr(s.section,"name",None)!r} roll={s.roll_number!r} group={s.student_group!r} optional={getattr(s.optional_subject,"name",None)!r} father={s.father_name!r} mother={s.mother_name!r}')

print()
target = None
for s in cands:
    if (s.student_group or '').lower() == 'arts':
        target = s; break
if target is None:
    target = cands.first()

print('=== TARGET ===', target.id, full(target), 'sec', getattr(target.section,'name',None), 'group', target.student_group)

rs = list(Result.objects.filter(student=target).order_by('examination_id','id'))
print('results count', len(rs))
tot = 0
for r in rs:
    print(f'  rid={r.id} exam={r.examination_id} subj={r.subject.name!r} cq={r.written_marks!r} mcq={r.mcq_marks!r} pr={r.practical_marks!r} total={r.total_obtained!r}')
    try: tot += float(r.total_obtained or 0)
    except: pass
print('SUM', tot)

print()
for o in StudentOverallResult.objects.filter(student=target):
    print(f'OVERALL exam={o.examination_id} {getattr(o.examination,"name",None)!r} total={o.total_marks_obtained} possible={o.total_marks_possible} cgpa={o.cgpa} grade={o.grade} passed={o.is_passed}')

print()
print('=== exam 1645 name/class ===')
from results.models import Examination
e = Examination.objects.get(id=1645)
print('exam 1645:', e.name, 'classroom=', getattr(e.classroom,'name',None), 'type=', e.exam_type, 'year=', getattr(e,'academic_year',None))
