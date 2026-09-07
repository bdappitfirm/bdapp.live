import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile

def check():
    students = StudentProfile.objects.select_related('user').filter(user__first_name__icontains='মহিন') | StudentProfile.objects.select_related('user').filter(user__first_name__icontains='সাব্বির')
    for s in students:
        u = s.user
        print(f"FN: '{u.first_name}' | LN: '{u.last_name}' | EN: '{u.first_name_en}' '{u.last_name_en}'")

if __name__ == '__main__':
    check()
