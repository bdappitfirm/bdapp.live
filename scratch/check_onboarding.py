import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School, SchoolOnboarding
from academics.models import ClassRoom, Subject, StudentProfile
from schools.onboarding import onboard_school

def check():
    for sid in [67, 68]:
        school = School.objects.filter(id=sid).first()
        if not school:
            print(f"School ID {sid} not found")
            continue

        onboarding = SchoolOnboarding.objects.filter(school=school).first()
        print(f"School: {school.name} (ID: {sid})")
        print(f"  Onboarding object exists: {bool(onboarding)}")

        if onboarding:
            print(f"    is_processed: {onboarding.is_processed}")
            print(f"    school_type: {onboarding.school_type}")
            print(f"    range: {onboarding.class_range_start} - {onboarding.class_range_end}")
            print(f"    sample_student_count: {onboarding.sample_student_count}")

            if not onboarding.is_processed:
                print(f"  Attempting to process onboarding for {school.name}...")
                success, message = onboard_school(sid)
                print(f"    Result: {success}, Message: {message}")

        print(f"  Current Counts:")
        print(f"    Classrooms: {school.classrooms.count()}")
        print(f"    Subjects: {school.subjects.count()}")
        print(f"    Students: {school.students.count()}")
        print("-" * 20)

if __name__ == "__main__":
    check()
