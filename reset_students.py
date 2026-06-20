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
print(f"School: {school.name}")

# Step 1: Delete ONLY data for schools 11 and 63 (NOT ALL schools!)
print("\n--- Deleting data for schools 11 and 63 ---")
for school_id in [11, 63]:
    school = School.objects.get(id=school_id)
    # Delete StudentProfile
    sp_count = StudentProfile.objects.filter(school=school).count()
    StudentProfile.objects.filter(school=school).delete()
    print(f"  Deleted {sp_count} StudentProfile for {school.name}")
    # Delete Profile
    p_count = Profile.objects.filter(school=school).count()
    Profile.objects.filter(school=school).delete()
    print(f"  Deleted {p_count} Profile for {school.name}")
    # Delete User that have Profile for this school
    # First get all User IDs associated with this school's profiles (that we just deleted)
    # Wait, let's get users that ONLY belong to this school
    # To be safe, we'll only delete users whose username starts with "11-" or "63-"
    user_count = User.objects.filter(username__startswith=f"{school_id}-").count()
    User.objects.filter(username__startswith=f"{school_id}-").delete()
    print(f"  Deleted {user_count} User for {school.name}")

# Step 2: Recreate admin user
print("\n--- Recreating admin user ---")
school_63 = School.objects.get(id=63)
# Check if admin user exists, if not create
try:
    admin_user = User.objects.get(username="bdadmin")
except User.DoesNotExist:
    admin_user = User.objects.create_superuser(
        username="bdadmin",
        email="admin@bdapp.live",
        password="12345678"
    )
# Check if admin profile exists, if not create
Profile.objects.get_or_create(
    user=admin_user,
    defaults={
        "school": school_63,
        "role": "admin"
    }
)
print("Admin user created/ready!")

# Step 3: Create students for a school
def create_students_for_school(school_id, class_configs, class_number_map):
    school = School.objects.get(id=school_id)
    print(f"\n--- Creating students for {school.name} (ID: {school_id}) ---")
    total_created = 0
    
    for class_name, sections in class_configs:
        # Get existing classroom or create if not exists
        classroom, created = ClassRoom.objects.get_or_create(school=school, name=class_name)
        print(f"\nProcessing {class_name}")
        
        for section_idx, (section_name, student_count) in enumerate(sections, 1):
            # Get existing section or create if not exists
            section, created = Section.objects.get_or_create(classroom=classroom, name=section_name)
            print(f"  {section_name}: {student_count} students")
            
            for roll in range(1, student_count + 1):
                class_num = class_number_map[class_name]
                section_num = f"{section_idx:02d}"
                roll_num = f"{roll:02d}"
                # Add school ID prefix to username to avoid conflicts between schools!
                student_id = f"{school_id}-{class_num}{section_num}{roll_num}"
                
                # Create user
                user, created = User.objects.get_or_create(
                    username=student_id,
                    defaults={
                        "password": "12345678",  # Wait, no—create_user sets the password properly!
                        "first_name": f"Student {roll}",
                    }
                )
                if created:
                    user.set_password("12345678")
                    user.save()
                
                # Create profile
                Profile.objects.get_or_create(
                    user=user,
                    defaults={
                        "school": school,
                        "role": "student",
                    }
                )
                
                # Create student profile
                StudentProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        "school": school,
                        "classroom": classroom,
                        "section": section,
                        "roll_number": str(roll),
                    }
                )
                
                total_created += 1
                if roll % 10 == 0:
                    print(f"    Created {roll}/{student_count}")
    
    print(f"\n✅ Done with {school.name}: {total_created} students created!")

# Define class configs for school 11 (uses Bengali names)
class_configs_school_11 = [
    ("ষষ্ঠ শ্রেণী", [("ক", 58), ("খ", 62), ("গ", 55)]),    # 175
    ("সপ্তম শ্রেণী", [("ক", 60), ("খ", 57), ("গ", 58)]),  # 175
    ("অষ্টম শ্রেণী", [("ক", 55), ("খ", 52), ("গ", 50)]),  # 157
    ("নবম শ্রেণী", [("বিজ্ঞান", 50), ("মানবিক", 53), ("ব্যবসায়", 48)]),  # 151
    ("দশম শ্রেণী", [("বিজ্ঞান", 48), ("মানবিক", 52), ("ব্যবসায়", 47)]),  # 147
]

# Define class configs for school 63 (uses English names)
class_configs_school_63 = [
    ("Six", [("ক", 58), ("খ", 62), ("গ", 55)]),    # 175
    ("Seven", [("ক", 60), ("খ", 57), ("গ", 58)]),  # 175
    ("Eight", [("ক", 55), ("খ", 52), ("গ", 50)]),  # 157
    ("Nine", [("বিজ্ঞান", 50), ("মানবিক", 53), ("ব্যবসায়", 48)]),  # 151
    ("Ten", [("বিজ্ঞান", 48), ("মানবিক", 52), ("ব্যবসায়", 47)]),  # 147
]

# Class number map
class_number_map = {
    "ষষ্ঠ শ্রেণী": "06",
    "সপ্তম শ্রেণী": "07",
    "অষ্টম শ্রেণী": "08",
    "নবম শ্রেণী": "09",
    "দশম শ্রেণী": "10",
    "Six": "06",
    "Seven": "07",
    "Eight": "08",
    "Nine": "09",
    "Ten": "10",
}

# Create students for both schools!
create_students_for_school(11, class_configs_school_11, class_number_map)
create_students_for_school(63, class_configs_school_63, class_number_map)

print("\n✅ All done!")
