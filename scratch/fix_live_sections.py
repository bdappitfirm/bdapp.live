import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import ClassRoom, Section, StudentProfile

try:
    cls = ClassRoom.objects.filter(school_id=57, id=208).first()
    if not cls:
        cls = ClassRoom.objects.filter(school_id=57, name__icontains='ষষ্ঠ').first()

    if cls:
        sec_g, created = Section.objects.get_or_create(classroom=cls, name='গ')
        print(f"Section গ for class {cls.name} (ID {cls.id}): ID {sec_g.id}, Created: {created}")

        unassigned_students = StudentProfile.objects.filter(school_id=57, classroom=cls, section__isnull=True)
        count = unassigned_students.update(section=sec_g)
        print(f"Successfully assigned {count} unassigned students to Section গ on LIVE DB.")
    else:
        print("Classroom 6 not found for school 57 on LIVE DB.")
except Exception as e:
    print(f"Error: {e}")
