import os
import django
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile

def check():
    students = StudentProfile.objects.select_related('user').all()
    count = 0
    for s in students:
        u = s.user
        if u and u.last_name and re.search(r'[a-zA-Z]', u.last_name):
            count += 1
            if count <= 20:
                print(f"FN: {u.first_name} | LN: {u.last_name}")
    print(f"Total students with English in last_name: {count}")

if __name__ == '__main__':
    check()
