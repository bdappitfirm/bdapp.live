
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile
from schools.models import School
import json

school = School.objects.get(id=19)
print(f"Exporting students for {school.name} (ID: {school.id})")

students = StudentProfile.objects.filter(school=school).order_by('id')
print(f"Total students found: {students.count()}")

data = []
for student in students:
    user_data = None
    if hasattr(student, 'user'):
        user_data = {
            'id': student.user.id,
            'username': student.user.username,
            'first_name': student.user.first_name,
            'last_name': student.user.last_name,
            'email': student.user.email,
            'phone_number': student.user.phone_number,
            'photo': str(student.user.photo) if student.user.photo else None,
            'thumbnail': str(student.user.thumbnail) if student.user.thumbnail else None,
            'is_active': student.user.is_active,
        }
    data.append({
        'id': student.id,
        'roll_number': student.roll_number,
        'group': student.student_group, # Corrected from .group to .student_group
        'gender': student.gender,
        'student_custom_id': student.student_custom_id,
        'guardian_name': student.guardian_name,
        'father_name': student.father_name,
        'mother_name': student.mother_name,
        'admission_date': str(student.admission_date) if student.admission_date else None,
        'address': student.address,
        'classroom_id': student.classroom_id,
        'section_id': student.section_id,
        'school_id': student.school_id,
        'remarks': student.remarks,
        'voter_number': student.voter_number,
        'user': user_data,
    })

with open('school_19_students.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Exported to school_19_students.json!")
