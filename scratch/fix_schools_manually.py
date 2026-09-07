import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School, SchoolOnboarding
from schools.onboarding import onboard_school

def run_fix():
    # Force process for specific schools
    target_ids = [67, 68]
    for sid in target_ids:
        school = School.objects.filter(id=sid).first()
        if not school:
            print(f"School {sid} not found.")
            continue

        onboarding, created = SchoolOnboarding.objects.get_or_create(
            school=school,
            defaults={
                'school_type': 'madrasah',
                'headmaster_name': 'Headmaster',
                'class_range_start': 1,
                'class_range_end': 12,
                'sample_student_count': 1,
                'is_processed': False
            }
        )

        # Reset just in case
        onboarding.is_processed = False
        onboarding.school_type = 'madrasah'
        onboarding.class_range_start = 1
        onboarding.class_range_end = 12
        onboarding.sample_student_count = 1
        onboarding.save()

        print(f"Manually triggering onboarding for {school.name} (ID: {sid})...")
        success, message = onboard_school(sid)
        print(f"Result: {success}, Message: {message}")

if __name__ == "__main__":
    run_fix()
