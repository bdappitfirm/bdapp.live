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

# Get school with id 11
school = School.objects.get(id=11)
print(f"Using school: {school.name}")

# Define class configurations
class_configs = [
    # (class_name, [ (section_name, student_count), ... ])
    ("Six", [("ক", 66), ("খ", 62)]),
    ("Seven", [("ক", 62), ("খ", 60)]),
    ("Eight", [("ক", 60), ("খ", 58)]),
    ("Nine", [("বিজ্ঞান", 42), ("মানবিক", 52), ("ব্যবসায়", 50)]),
    ("Ten", [("বিজ্ঞান", 40), ("মানবিক", 50), ("ব্যবসায়", 48)]),
]

# Class number mapping (for ID generation)
class_number_map = {
    "Six": "06",
    "Seven": "07",
    "Eight": "08",
    "Nine": "09",
    "Ten": "10",
}

total_students_created = 0

for class_name, sections in class_configs:
    # Create or get classroom
    classroom, created = ClassRoom.objects.get_or_create(school=school, name=class_name)
    print(f"\nProcessing {class_name} (ClassRoom ID: {classroom.id})")
    
    for section_idx, (section_name, student_count) in enumerate(sections, 1):
        # Create or get section
        section, created = Section.objects.get_or_create(classroom=classroom, name=section_name)
        print(f"  - Section {section_name} (Section ID: {section.id}, creating {student_count} students)")
        
        # Generate students for this section
        for roll in range(1, student_count + 1):
            # Generate ID
            class_num = class_number_map[class_name]
            section_num = f"{section_idx:02d}"
            roll_num = f"{roll:02d}"
            student_id = f"{class_num}{section_num}{roll_num}"
            
            # Create user
            username = student_id
            password = "12345678"
            
            # Check if user already exists
            if User.objects.filter(username=username).exists():
                continue
            
            # Create user
            user = User.objects.create_user(
                username=username,
                password=password,
                first_name=f"Student {roll}",
            )
            
            # Create profile if not exists
            if not Profile.objects.filter(user=user).exists():
                Profile.objects.create(
                    user=user,
                    school=school,
                    role="student",
                )
            
            # Create student profile if not exists
            if not StudentProfile.objects.filter(user=user).exists():
                StudentProfile.objects.create(
                    user=user,
                    school=school,
                    classroom=classroom,
                    section=section,
                    roll_number=str(roll),
                )
            
            total_students_created += 1
            if roll % 10 == 0:
                print(f"    - Created {roll}/{student_count} students for this section...")

print(f"\n✅ Done! Total students created: {total_students_created}")
