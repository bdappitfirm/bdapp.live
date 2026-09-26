import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from academics.models import ClassRoom

def check():
    school = School.objects.filter(name__icontains='বহেরা').first()
    if not school:
        print("Bohera school not found.")
        return

    print(f"School: {school.name} (ID: {school.id})")
    classes = ClassRoom.objects.filter(school=school)
    names = {}
    for c in classes:
        names.setdefault(c.name, []).append(c.id)

    for name, ids in names.items():
        if len(ids) > 1:
            print(f"Duplicate Class Found: {name} -> IDs: {ids}")

if __name__ == "__main__":
    check()
