import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School, SchoolOnboarding
from schools.onboarding import onboard_school
from academics.models import ClassRoom, Subject, StudentProfile

def test_manual():
    # Attempting to fix School 67 (Alim Madrasah) and 68
    for sid in [67, 68]:
        school = School.objects.filter(id=sid).first()
        if not school:
            print(f"School {sid} not found. Creating it...")
            school = School.objects.create(id=sid, name=f"Test School {sid}", address="Address")

        onboarding, created = SchoolOnboarding.objects.get_or_create(
            school=school,
            defaults={
                'school_type': 'madrasah',
                'headmaster_name': 'Manual Test Headmaster',
                'class_range_start': 1,
                'class_range_end': 12,
                'sample_student_count': 1,
                'is_processed': False
            }
        )
        if not created:
            onboarding.is_processed = False
            onboarding.school_type = 'madrasah'
            onboarding.class_range_start = 1
            onboarding.class_range_end = 12
            onboarding.sample_student_count = 1
            onboarding.save()

        print(f"Processing School {sid} ({school.name})...")
        success, message = onboard_school(sid)
        print(f"Result: {success}, Message: {message}")

        # Verify
        print(f"  Classrooms: {school.classrooms.count()}")
        print(f"  Subjects: {school.subjects.count()}")
        print(f"  Students: {school.students.count()}")

        # Check if student in Dakhil 10 has results
        d10 = school.classrooms.filter(name__icontains='Dakhil 10').first()
        if d10:
            student = school.students.filter(classroom=d10).first()
            if student:
                from results.models import Result
                res_count = Result.objects.filter(student=student).count()
                print(f"  Student {student.user.username} in Dakhil 10 has {res_count} results.")
            else:
                print("  No student found in Dakhil 10.")
        else:
            print("  Dakhil 10 not found.")

if __name__ == "__main__":
    test_manual()
