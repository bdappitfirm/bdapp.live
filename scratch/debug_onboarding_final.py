import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School, SchoolOnboarding
from academics.models import ClassRoom, Subject, StudentProfile, Section
from results.models import Examination, Result
from schools.onboarding import onboard_school

def debug():
    # Looking for schools created recently or with specific IDs
    target_ids = [67, 68, 69, 70] # Adding a few more just in case

    schools = School.objects.filter(id__in=target_ids)
    if not schools.exists():
        # Maybe IDs shifted, let's look for most recent
        schools = School.objects.order_by('-id')[:5]

    for school in schools:
        print(f"\n--- School: {school.name} (ID: {school.id}) ---")
        onboarding = SchoolOnboarding.objects.filter(school=school).first()

        if not onboarding:
            print("  No SchoolOnboarding object found!")
            continue

        print(f"  Onboarding Status: Processed={onboarding.is_processed}, Type={onboarding.school_type}")
        print(f"  Range: {onboarding.class_range_start} to {onboarding.class_range_end}")
        print(f"  Sample Students requested: {onboarding.sample_student_count}")

        # If not processed, or user says it failed, let's try processing it now and capture output
        if not onboarding.is_processed:
            print(f"  Triggering onboard_school({school.id})...")
            success, message = onboard_school(school.id)
            print(f"  Result: {success}, Message: {message}")
        else:
            print("  Already processed. Let's check data anyway.")

        # Data Check
        classrooms = school.classrooms.all()
        print(f"  Classrooms count: {classrooms.count()}")
        for cls in classrooms[:3]: # Show first 3
            secs = cls.sections.count()
            subjs = Subject.objects.filter(classrooms=cls).count()
            print(f"    - {cls.name}: {secs} sections, {subjs} subjects linked")

        subjects = school.subjects.all()
        print(f"  Total Subjects count: {subjects.count()}")

        students = school.students.all()
        print(f"  Total Students count: {students.count()}")
        for stu in students:
            res_count = Result.objects.filter(student=stu).count()
            print(f"    - Student: {stu.user.get_full_name()} (Roll: {stu.roll_number}), Results: {res_count}")

        exams = Examination.objects.filter(school=school)
        print(f"  Examinations count: {exams.count()}")
        for ex in exams:
            print(f"    - Exam: {ex.name} ({ex.exam_type})")

if __name__ == "__main__":
    debug()
