import os, sys, django
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile
from results.models import Result, StudentOverallResult, Examination
from django.db.models import Q

def full(s):
    u = s.user
    return f"{getattr(u,'first_name','')} {getattr(u,'last_name','')}".strip()

stu = StudentProfile.objects.select_related('classroom', 'section', 'user').filter(id=7294).first()
print("STUDENT:", stu.id, full(stu), "cls=", getattr(stu.classroom, 'name', None),
      "cls_id=", stu.classroom_id, "sec=", getattr(stu.section, 'name', None),
      "sec_id=", stu.section_id, "roll=", stu.roll_number, "group=", stu.student_group)

# examination(s) referenced by the student's results
ex_ids = list(Result.objects.filter(student=stu).values_list('examination_id', flat=True).distinct())
print("student exam ids:", ex_ids)
for e in Examination.objects.filter(id__in=ex_ids):
    print(f"  exam {e.id} name={e.name!r} type={getattr(e,'exam_type',None)!r} year={getattr(e,'year',None)!r} date={getattr(e,'exam_date',None)!r} classroom={e.classroom_id} cls_name={getattr(e.classroom,'name',None)!r}")

ex = Examination.objects.filter(id__in=ex_ids).first()
exam_type = getattr(ex, 'exam_type', None)
yr = getattr(ex, 'year', None) or (ex.exam_date.year if getattr(ex, 'exam_date', None) else None)
sid = ex.school_id
classroom_id = ex.classroom_id
section_id = stu.section_id

print("\n=== emulate combined_rank_list_by_exam_type ===")
print("params: exam_type=", exam_type, "classroom=", classroom_id, "section=", section_id, "school=", sid, "year=", yr)

qs = StudentOverallResult.objects.filter(
    examination__school_id=sid,
    examination__exam_type=exam_type,
    examination__classroom_id=classroom_id,
)
if section_id:
    qs = qs.filter(student__section_id=section_id)
if yr:
    qs = qs.filter(Q(examination__year=yr) | Q(examination__exam_date__year=yr))

print("rows (section-filtered):", qs.count())
for o in qs.select_related('student', 'student__user', 'student__section', 'student__classroom', 'examination'):
    s = o.student
    print(f"  ov={o.id} stu={s.id} {full(s)!r} sec_id={s.section_id} sec={getattr(s.section,'name',None)!r} roll={s.roll_number!r} grp={s.student_group!r} exam={o.examination_id} total={o.total_marks_obtained} cgpa={o.cgpa} passed={o.is_passed}")

print("\n=== WITHOUT section filter (whole classroom) ===")
qs2 = StudentOverallResult.objects.filter(
    examination__school_id=sid,
    examination__exam_type=exam_type,
    examination__classroom_id=classroom_id,
)
if yr:
    qs2 = qs2.filter(Q(examination__year=yr) | Q(examination__exam_date__year=yr))
print("rows:", qs2.count())
for o in qs2.select_related('student', 'student__user', 'student__section', 'examination').order_by('student_id'):
    s = o.student
    print(f"  ov={o.id} stu={s.id} {full(s)!r} sec_id={s.section_id} sec={getattr(s.section,'name',None)!r} roll={s.roll_number!r} exam={o.examination_id} total={o.total_marks_obtained}")
