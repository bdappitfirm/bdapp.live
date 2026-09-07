import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile

def cleanup():
    students = StudentProfile.objects.select_related('user').all()
    count = 0
    for s in students:
        u = s.user
        if u and u.first_name and u.last_name_en:
            fn = u.first_name.strip()
            ln_en = u.last_name_en.strip()
            if fn.lower().endswith(ln_en.lower()):
                u.last_name_en = ''
                u.save(update_fields=['last_name_en'])
                count += 1
    print(f"Cleaned up {count} student last_name_en fields.")

if __name__ == '__main__':
    cleanup()
