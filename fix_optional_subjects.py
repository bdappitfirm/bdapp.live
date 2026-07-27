import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile, Subject, ClassRoom
from django.db.models import Q

def fix_optional_subjects():
    print("🚀 Starting fix for existing students' optional subjects (Class 9-10)...")

    # 1. Identify Class 9-10 Classrooms
    classrooms = ClassRoom.objects.filter(
        Q(name__icontains='নবম') | Q(name__icontains='দশম') |
        Q(name__icontains='nine') | Q(name__icontains='ten') |
        Q(name__icontains='9') | Q(name__icontains='10') |
        Q(name__icontains='SSC')
    )

    if not classrooms.exists():
        print("❌ No Class 9 or 10 classrooms found.")
        return

    classroom_ids = classrooms.values_list('id', flat=True)
    students = StudentProfile.objects.filter(classroom_id__in=classroom_ids)

    print(f"Found {students.count()} students in Class 9-10.")

    updated_count = 0
    for student in students:
        # Determine target subject name
        target_name = ""
        group = (student.student_group or "").lower()

        if group == 'science':
            target_name = 'উচ্চতর গণিত'
        elif group in ['arts', 'commerce', 'humanities', 'business']:
            target_name = 'কৃষি'

        if not target_name:
            continue

        # Find the subject in the school
        subject = Subject.objects.filter(
            Q(school_id=student.school_id),
            Q(name__icontains=target_name) |
            (Q(name__icontains='Higher Math') if target_name == 'উচ্চতর গণিত' else Q(name__icontains='Agriculture'))
        ).first()

        if subject:
            # Only update if it's currently empty or different
            if not student.optional_subject or student.optional_subject_id != subject.id:
                student.optional_subject = subject
                student.save()
                updated_count += 1
                print(f"✅ Updated {student.user.get_full_name()} (Roll: {student.roll_number}) -> {subject.name}")

    print(f"🏁 Finished. Total students updated: {updated_count}")

if __name__ == "__main__":
    fix_optional_subjects()
