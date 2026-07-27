
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile, ClassRoom, Section
from schools.models import School

school = School.objects.get(id=19)
print(f"School: {school.name}")

classrooms = ClassRoom.objects.filter(school=school).order_by('id')
print("\nClassrooms:")
for classroom in classrooms:
    sections = Section.objects.filter(classroom=classroom)
    print(f"  - {classroom.name} (ID: {classroom.id})")
    for section in sections:
        print(f"    Section: {section.name} (ID: {section.id})")

print("\nStudents:")
total = 0
sectionless = []
for student in StudentProfile.objects.filter(school=school).order_by('id'):
    total +=1
    if not student.section:
        sectionless.append(student)
    print(f"  ID: {student.id}, Roll: {student.roll_number}, Class: {student.classroom.name if student.classroom else 'N/A'}, Section: {student.section.name if student.section else 'None'}")

print(f"\nTotal: {total}, Sectionless: {len(sectionless)}")
