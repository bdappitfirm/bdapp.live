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

# Define class configurations
class_configs = [
    # (class_name, [ (section_name, student_count), ... ])
    # Six and Seven: start from roll 101 to avoid conflict with existing
    ("Six", [("ক", (101, 158)), ("খ", (101, 162)), ("গ", (101, 155))]),    # 58, 62, 55
    ("Seven", [("ক", (101, 160)), ("খ", (101, 157)), ("গ", (101, 158))]),  # 60, 57, 58
    ("Eight", [("ক", (1, 55)), ("খ", (1, 52)), ("গ", (1, 50))]),  # 55,52,50
    # Nine and Ten: less than 60 each
    ("Nine", [("বিজ্ঞান", (1, 50)), ("মানবিক", (1, 53)), ("ব্যবসায়", (1, 48))]),  # 50,53,48
    ("Ten", [("বিজ্ঞান", (1, 48)), ("মানবিক", (1, 52)), ("ব্যবসায়", (1, 47))]),  # 48,52,47
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
total_existing = 0

for class_name, sections in class_configs:
    # Create or get classroom
    classroom, created = ClassRoom.objects.get_or_create(school=school, name=class_name)
    print(f"\nProcessing {class_name} (ClassRoom ID: {classroom.id})")
    
    for section_idx, (section_name, roll_range) in enumerate(sections, 1):
        # Create or get section
        section, created = Section.objects.get_or_create(classroom=classroom, name=section_name)
        start_roll, end_roll = roll_range
        student_count = end_roll - start_roll + 1
        print(f"  - Section {section_name} (Section ID: {section.id}, creating {student_count} students, rolls {start_roll}-{end_roll})")
        
        # Generate students for this section
        section_created = 0
        section_existing = 0
        
        for roll in range(start_roll, end_roll + 1):
            # Generate ID
            class_num = class_number_map[class_name]
            section_num = f"{section_idx:02d}"
            roll_num = f"{roll:03d}"  # Use 3 digits to avoid conflict with existing 2-digit
            student_id = f"{class_num}{section_num}{roll_num}"
            
            # Create user
            username = student_id
            password = "12345678"
            
            # Check if user already exists
            if User.objects.filter(username=username).exists():
                section_existing += 1
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
            section_created += 1
            if roll % 10 == 0:
                print(f"    - Created {roll}/{student_count} students for this section...")
        
        print(f"  - Section {section_name}: {section_created} created, {section_existing} already existed")
        total_existing += section_existing

print(f"\n✅ Done! Total students created: {total_students_created}, already existed: {total_existing}")
print(f"✅ Total students in school 63: {total_students_created + total_existing}")
