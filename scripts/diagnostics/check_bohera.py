import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from academics.models import ClassRoom, StudentProfile
from results.models import Result, Examination
from django.contrib.auth.models import User

def check():
    # Find Bohera school (বহেরা)
    school = School.objects.filter(name__icontains='বহেরা').first()
    if not school:
        print("Bohera school not found.")
        return

    print(f"School: {school.name} (ID: {school.id})")

    # Classrooms in this school
    classrooms = ClassRoom.objects.filter(school=school)
    print("\nClassrooms:")
    for c in classrooms:
        print(f"  - {c.name} (ID: {c.id})")

    # Teacher Said
    teacher = User.objects.filter(username__icontains='said').first()
    if teacher:
        print(f"\nTeacher Said: {teacher.username} (ID: {teacher.id})")
    else:
        print("\nTeacher Said not found.")

    # Results entered by Said on July 29, 2026 (Wednesday)
    import datetime
    start = datetime.datetime(2026, 7, 29, 0, 0)
    end = datetime.datetime(2026, 7, 29, 23, 59)

    results = Result.objects.filter(created_at__range=(start, end), examination__school=school)
    print(f"\nResults entered on July 29: {results.count()}")

    for r in results[:20]:
        print(f"  Result ID: {r.id}, Student: {r.student.user.username}, Subject: {r.subject.name}, Exam: {r.examination.name} (ID: {r.examination.id}), Classroom: {r.examination.classroom.name}")

if __name__ == "__main__":
    check()
