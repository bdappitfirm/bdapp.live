import os
import django
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile

def check():
    students = StudentProfile.objects.select_related('user').filter(school_id=63)
    for s in students:
        u = s.user
        if re.search(r'[a-zA-Z]', u.first_name) or re.search(r'[a-zA-Z]', u.last_name):
            print(f"FN: '{u.first_name}' | LN: '{u.last_name}'")

if __name__ == '__main__':
    check()
