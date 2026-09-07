import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile

def check():
    students = StudentProfile.objects.select_related('user').filter(user__first_name__icontains='Mohin') | StudentProfile.objects.select_related('user').filter(user__first_name__icontains='Sabbir')
    for s in students:
        u = s.user
        print(f"ID: {s.id}, FN: '{u.first_name}', LN: '{u.last_name}', EN_FN: '{u.first_name_en}', EN_LN: '{u.last_name_en}'")

if __name__ == '__main__':
    check()
