import os
import django
from decimal import Decimal
from datetime import date

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from schools.models import School
from academics.models import ClassRoom, Section, Subject, StudentProfile
from results.models import Examination, Result, StudentOverallResult

User = get_user_model()

def setup_madrasah():
    school_id = 67
    school_name = "Alim Madrasah"

    # 1. Create or Get School
    school, created = School.objects.get_or_create(
        id=school_id,
        defaults={
            'name': school_name,
            'address': 'Madrasah Road, Education Zone',
            'ein': '123456'
        }
    )
    if not created:
        print(f"School {school_name} already exists.")
    else:
        print(f"Created school: {school_name}")

    # 2. Define Classrooms and Sections
    # Using Madrasah nomenclature where appropriate
    classroom_data = [
        ("Ibtedayi 1", ["A"]),
        ("Ibtedayi 2", ["A"]),
        ("Ibtedayi 3", ["A"]),
        ("Ibtedayi 4", ["A"]),
        ("Ibtedayi 5", ["A"]),
        ("Dakhil 6", ["A"]),
        ("Dakhil 7", ["A"]),
        ("Dakhil 8", ["A"]),
        ("Dakhil 9", ["A", "B"]),
        ("Dakhil 10", ["A", "B"]),
        ("Alim 1st Year", ["A"]),
        ("Alim 2nd Year", ["A"]),
    ]

    classrooms = {}
    for cls_name, sec_names in classroom_data:
        classroom, _ = ClassRoom.objects.get_or_create(school=school, name=cls_name)
        classrooms[cls_name] = classroom
        for sec_name in sec_names:
            Section.objects.get_or_create(classroom=classroom, name=sec_name)
    print("Classrooms and Sections created.")

    # 3. Define Subjects
    # Common Madrasah subjects
    subjects_to_create = [
        "Quran Majid & Tajwid",
        "Hadith Sharif",
        "Fiqh & Usul-e-Fiqh",
        "Arabic 1st Paper",
        "Arabic 2nd Paper",
        "Bangla 1st Paper",
        "Bangla 2nd Paper",
        "English 1st Paper",
        "English 2nd Paper",
        "Mathematics",
        "General Science",
        "BGS",
        "ICT",
        "Balagat & Mantiq",
        "History of Islam"
    ]

    subject_objs = {}
    for sub_name in subjects_to_create:
        sub, _ = Subject.objects.get_or_create(school=school, name=sub_name)
        subject_objs[sub_name] = sub
    print("Subjects created.")

    # Assign subjects to Class 10 (Dakhil 10)
    class10 = classrooms["Dakhil 10"]
    dakhil_10_subjects = [
        "Quran Majid & Tajwid", "Hadith Sharif", "Fiqh & Usul-e-Fiqh",
        "Arabic 1st Paper", "Arabic 2nd Paper", "Bangla 1st Paper",
        "Bangla 2nd Paper", "English 1st Paper", "English 2nd Paper",
        "Mathematics", "ICT", "General Science", "BGS"
    ]
    for sub_name in dakhil_10_subjects:
        subject_objs[sub_name].classrooms.add(class10)
    print("Subjects assigned to Class 10.")

    # 4. Create Sample Student in Class 10
    username = "student_alim_67"
    if not User.objects.filter(username=username).exists():
        student_user = User.objects.create_user(
            username=username,
            password="password123",
            first_name="Abdullah",
            last_name="Al Mamun"
        )
    else:
        student_user = User.objects.get(username=username)

    section_a = Section.objects.get(classroom=class10, name="A")
    student_profile, _ = StudentProfile.objects.get_or_create(
        user=student_user,
        school=school,
        defaults={
            'classroom': class10,
            'section': section_a,
            'roll_number': '101',
            'student_group': 'science',
            'gender': 'male',
            'father_name': 'Abdur Rahman',
            'mother_name': 'Fatema Begum',
        }
    )
    print(f"Sample student created: {student_user.get_full_name()}")

    # 5. Create Annual Examination 2026
    exam, _ = Examination.objects.get_or_create(
        school=school,
        classroom=class10,
        name="Annual Examination 2026",
        defaults={
            'exam_type': 'annual',
            'exam_date': date(2026, 11, 15),
            'year': 2026,
            'total_marks': 100,
            'pass_marks': 33
        }
    )
    print("Annual Examination 2026 created.")

    # 6. Create Sample Results for the student
    # Marks distribution for Class 10 (approximate)
    # Most subjects 100 marks (70 written + 30 mcq)
    # ICT 50 marks
    results_data = [
        ("Quran Majid & Tajwid", 65, 25, 0),
        ("Hadith Sharif", 60, 22, 0),
        ("Fiqh & Usul-e-Fiqh", 58, 20, 0),
        ("Arabic 1st Paper", 75, 0, 0),
        ("Arabic 2nd Paper", 70, 0, 0),
        ("Bangla 1st Paper", 62, 24, 0),
        ("Bangla 2nd Paper", 55, 20, 0),
        ("English 1st Paper", 85, 0, 0),
        ("English 2nd Paper", 78, 0, 0),
        ("Mathematics", 68, 26, 0),
        ("ICT", 20, 15, 10), # ICT total 45/50
        ("General Science", 50, 20, 20),
        ("BGS", 64, 23, 0),
    ]

    for sub_name, written, mcq, practical in results_data:
        subject = subject_objs[sub_name]
        Result.objects.update_or_create(
            examination=exam,
            student=student_profile,
            subject=subject,
            defaults={
                'written_marks': Decimal(str(written)),
                'mcq_marks': Decimal(str(mcq)),
                'practical_marks': Decimal(str(practical))
            }
        )
    print("Sample results created.")

    # 7. Trigger Overall Result Calculation
    # Usually this is done via a task, but we can do it manually here
    calculate_overall(exam, student_profile)
    print("Overall result calculated.")

def calculate_overall(examination, student):
    results = Result.objects.filter(examination=examination, student=student)
    total_obtained = sum(r.total_obtained for r in results)

    # For simplification, assume each subject is 100 unless ICT
    total_possible = 0
    total_gpa = Decimal('0.00')
    count = 0
    failed = 0

    for r in results:
        # Simplified total_possible logic for this script
        if "ICT" in r.subject.name:
            total_possible += 50
        else:
            total_possible += 100

        total_gpa += r.gpa
        count += 1
        if not r.is_passed:
            failed += 1

    cgpa = total_gpa / count if count > 0 else Decimal('0.00')
    if failed > 0:
        cgpa = Decimal('0.00')
        grade = 'F'
    else:
        if cgpa >= 5.00: grade = 'A+'
        elif cgpa >= 4.00: grade = 'A'
        elif cgpa >= 3.50: grade = 'A-'
        elif cgpa >= 3.00: grade = 'B'
        elif cgpa >= 2.00: grade = 'C'
        elif cgpa >= 1.00: grade = 'D'
        else: grade = 'F'

    StudentOverallResult.objects.update_or_create(
        examination=examination,
        student=student,
        defaults={
            'total_marks_obtained': total_obtained,
            'total_marks_possible': Decimal(str(total_possible)),
            'cgpa': cgpa,
            'grade': grade,
            'is_passed': failed == 0,
            'failed_subjects_count': failed,
            'percentage': (total_obtained / total_possible * 100) if total_possible > 0 else 0
        }
    )

if __name__ == "__main__":
    setup_madrasah()
