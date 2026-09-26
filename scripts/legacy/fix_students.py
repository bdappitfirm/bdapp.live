import os
import django
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in os.sys.path:
    os.sys.path.insert(0, str(ROOT_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import User, Profile
from schools.models import School
from academics.models import ClassRoom, Section, StudentProfile

# Get school with id 63
school = School.objects.get(id=63)
print(f"Using school: {school.name}")

# First, delete students with 3-digit roll numbers in Six and Seven
print("\n--- Deleting wrong students (3-digit rolls) ---")
for class_name in ["Six", "Seven"]:
    try:
        classroom = ClassRoom.objects.get(school=school, name=class_name)
        sections = Section.objects.filter(classroom=classroom)
        for section in sections:
            students = StudentProfile.objects.filter(school=school, classroom=classroom, section=section)
            for student in students:
                if len(student.roll_number) == 3 or int(student.roll_number) > 99:
                    print(f"  Deleting {class_name}/{section.name}: Roll {student.roll_number} (User: {student.user.username})")
                    # Delete user (will cascade delete profile and student profile)
                    student.user.delete()
    except ClassRoom.DoesNotExist:
        pass

print("\n--- Adding correct students ---")

# Define class configurations with 2-digit rolls
class_configs = [
    ("Six", [("ক", (1, 58)), ("খ", (1, 62)), ("গ", (1, 55))]),
    ("Seven", [("ক", (1, 60)), ("খ", (1, 57)), ("গ", (1, 58))]),
    ("Eight", [("ক", (1, 55)), ("খ", (1, 52)), ("গ", (1, 50))]),
    ("Nine", [("বিজ্ঞান", (1, 50)), ("মানবিক", (1, 53)), ("ব্যবসায়", (1, 48))]),
    ("Ten", [("বিজ্ঞান", (1, 48)), ("মানবিক", (1, 52)), ("ব্যবসায়", (1, 47))]),
]

class_number_map = {
    "Six": "06",
    "Seven": "07",
    "Eight": "08",
    "Nine": "09",
    "Ten": "10",
}

total_students_created = 0
total_existing = 0

for class_name, sections in class_configs:
    classroom, created = ClassRoom.objects.get_or_create(school=school, name=class_name)
    print(f"\nProcessing {class_name} (ClassRoom ID: {classroom.id})")
    
    for section_idx, (section_name, roll_range) in enumerate(sections, 1):
        section, created = Section.objects.get_or_create(classroom=classroom, name=section_name)
        start_roll, end_roll = roll_range
        student_count = end_roll - start_roll + 1
        print(f"  - Section {section_name} (Section ID: {section.id}, creating {student_count} students, rolls {start_roll}-{end_roll})")
        
        section_created = 0
        section_existing = 0
        
        for roll in range(start_roll, end_roll + 1):
            class_num = class_number_map[class_name]
            section_num = f"{section_idx:02d}"
            roll_num = f"{roll:02d}"
            student_id = f"{class_num}{section_num}{roll_num}"
            
            username = student_id
            password = "12345678"
            
            if User.objects.filter(username=username).exists():
                section_existing += 1
                continue
            
            user = User.objects.create_user(
                username=username,
                password=password,
                first_name=f"Student {roll}",
            )
            
            if not Profile.objects.filter(user=user).exists():
                Profile.objects.create(
                    user=user,
                    school=school,
                    role="student",
                )
            
            if not StudentProfile.objects.filter(user=user).exists():
                StudentProfile.objects.create(
                    user=user,
                    school=school,
                    classroom=classroom,
                    section=section,
                    roll_number=str(roll),
                )
            
            total_students_created += 1
            section_created += 1
            if roll % 10 == 0:
                print(f"    - Created {roll}/{student_count} students for this section...")
        
        print(f"  - Section {section_name}: {section_created} created, {section_existing} already existed")
        total_existing += section_existing

print(f"\n✅ Done! Total students created: {total_students_created}, already existed: {total_existing}")
print(f"✅ Total students in school 63: {total_students_created + total_existing}")
