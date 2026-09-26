import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile, Subject, ClassRoom
from django.db.models import Q

def restore_optional_subjects():
    print("🚀 Restoring optional subjects for Class 9-10 students...")
    classrooms = ClassRoom.objects.filter(
        Q(name__icontains='নবম') | Q(name__icontains='দশম') |
        Q(name__icontains='nine') | Q(name__icontains='ten') |
        Q(name__icontains='9') | Q(name__icontains='10') |
        Q(name__icontains='SSC')
    )
    classroom_ids = classrooms.values_list('id', flat=True)
    students = StudentProfile.objects.filter(classroom_id__in=classroom_ids)
    print(f"Found {students.count()} students in Class 9-10.")

    updated_count = 0
    for student in students:
        group = (student.student_group or "").lower()
        target_names = []
        if group == 'science':
            target_names = ['Higher Mathematics', 'উচ্চতর গণিত', 'Higher Math', 'উচ্চতর গনিত']
        elif group in ['arts', 'commerce', 'humanities', 'business']:
            target_names = ['Agriculture', 'কৃষি শিক্ষা', 'কৃষি', 'গার্হস্থ্য বিজ্ঞান', 'Home Science']

        if not target_names:
            continue

        subj = None
        for name in target_names:
            subj = Subject.objects.filter(school_id=student.school_id, name__icontains=name).first()
            if subj: break

        if subj and (not student.optional_subject or student.optional_subject_id != subj.id):
            student.optional_subject = subj
            student.save(update_fields=['optional_subject'])
            updated_count += 1

    print(f"🏁 Finished. Restored optional subjects for {updated_count} students.")

if __name__ == "__main__":
    restore_optional_subjects()
