import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import Profile

def check():
    students_with_desig = Profile.objects.filter(role='student').exclude(designation__isnull=True).exclude(designation='')
    print(f"Student profiles with designation set: {students_with_desig.count()}")
    for p in students_with_desig[:10]:
        print(f"User: {p.user.get_full_name()}, Designation: {p.designation}")

if __name__ == '__main__':
    check()
