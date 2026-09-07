import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile

def check():
    students = StudentProfile.objects.select_related('user').all()[:20]
    for s in students:
        u = s.user
        print(f"Name: {u.first_name} {u.last_name}, Username: {u.username}")

if __name__ == '__main__':
    check()
