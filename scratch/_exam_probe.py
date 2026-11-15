import os, sys, django
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Examination, Result
from academics.models import StudentProfile

SID = 2126
CID = 133

s = StudentProfile.objects.filter(id=SID).first()
print('student:', s.id if s else None, 'class=', getattr(getattr(s, 'classroom', None), 'id', None),
      'section=', getattr(getattr(s, 'section', None), 'id', None))

print('\n=== all examinations for classroom 133 ===')
for ex in Examination.objects.filter(classroom_id=CID).order_by('id'):
    cnt_student = Result.objects.filter(examination=ex, student_id=SID).count()
    cnt_all = Result.objects.filter(examination=ex).count()
    print(f'  id={ex.id} type={ex.exam_type!r} name={ex.name!r} year={ex.year!r} date={ex.exam_date!r} school={ex.school_id} stuResults={cnt_student} allResults={cnt_all}')

print('\n=== results of student 2126 ===')
for r in Result.objects.filter(student_id=SID).order_by('examination_id'):
    print(f'  rid={r.id} exam={r.examination_id} (type={r.examination.exam_type!r} year={r.examination.year!r} class={r.examination.classroom_id}) subj={r.subject.name!r} w={r.written_marks} m={r.mcq_marks} p={r.practical_marks} tot={r.total_obtained}')
