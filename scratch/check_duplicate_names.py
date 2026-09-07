import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile

def check():
    students = StudentProfile.objects.select_related('user').all()
    print(f"Total students: {students.count()}")
    count = 0
    for s in students:
        u = s.user
        fn = u.first_name or ''
        ln = u.last_name or ''
        if ln:
            count += 1
            if count <= 20:
                print(f"FN: '{fn}' | LN: '{ln}'")

    print(f"Students with last_name set: {count}")

if __name__ == '__main__':
    check()
