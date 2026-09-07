import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from academics.models import StudentProfile, ClassRoom
from results.models import Result

def debug():
    school = School.objects.filter(id=19).first()
    if not school:
        print("School 19 not found")
        return

    # Search by name Nihamul or roll 20 in Class 7
    students = StudentProfile.objects.filter(school=school)

    found = []
    for s in students:
        name = s.user.get_full_name().lower()
        uname = s.user.username.lower()
        cls_name = s.classroom.name.lower() if s.classroom else ''
        if 'nihamul' in name or 'নিহামুল' in name or ('20' in str(s.roll_number) and ('seven' in cls_name or 'সপ্তম' in cls_name or '7' in cls_name)):
            found.append(s)

    print(f"Found {len(found)} matching students:")
    for s in found:
        print(f"ID={s.id}, Name={s.user.get_full_name()}, Roll={s.roll_number}, Class={s.classroom.name if s.classroom else 'None'}, Section={s.section.name if s.section else 'None'}")
        results = Result.objects.filter(student=s)
        print(f"  Result rows: {results.count()}")
        for r in results:
            print(f"    - Exam: {r.examination.name} (Type: {r.examination.exam_type}), Subject: {r.subject.name if r.subject else 'None'}, Total: {r.total_obtained}")

if __name__ == '__main__':
    debug()
