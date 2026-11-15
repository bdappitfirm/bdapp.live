import os, sys, django
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import StudentOverallResult

# What the broken fallback endpoint returns for ?student=7294&examination=1645
# (viewset ignores `student`, filters only examination + school, ordering = -cgpa, student)
qs = StudentOverallResult.objects.filter(examination_id=1645, examination__school_id=63)
print("rows for exam 1645 school 63:", qs.count())
print("first 5 by default ordering (-cgpa, student):")
for o in qs.select_related('student', 'student__user').order_by('-cgpa', 'student')[:5]:
    s = o.student
    nm = f"{s.user.first_name} {s.user.last_name}".strip()
    print(f"  ov={o.id} stu={s.id} {nm!r} sec={s.section_id} roll={s.roll_number!r} total={o.total_marks_obtained} cgpa={o.cgpa} grade={o.grade}")

print()
print("=> frontend takes list[0] as 'the student's overall':")
first = qs.select_related('student', 'student__user').order_by('-cgpa', 'student').first()
print("   list[0].student.id =", first.student_id, "total =", first.total_marks_obtained, "cgpa =", first.cgpa)
print("   (requested student id = 7294, whose real total = 381.00)")
