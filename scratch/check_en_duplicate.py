import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile

def check():
    students = StudentProfile.objects.select_related('user').all()
    count = 0
    for s in students:
        u = s.user
        fn = (u.first_name or '').strip()
        ln_en = (u.last_name_en or '').strip()
        if fn and ln_en and fn.lower().endswith(ln_en.lower()):
            count += 1
            if count <= 15:
                print(f"FN: '{fn}' | LN_EN: '{ln_en}'")
    print(f"Total matching: {count}")

if __name__ == '__main__':
    check()
