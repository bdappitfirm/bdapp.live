import os
import django
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile

def get_clean_name(fn, ln):
    if not fn: fn = ''
    if not ln: ln = ''
    combined = f"{fn} {ln}".strip()
    words = re.split(r'\s+', combined)
    seen = []
    for w in words:
        if w not in seen:
            seen.append(w)
    return ' '.join(seen)

def test():
    students = StudentProfile.objects.select_related('user').all()[:30]
    for s in students:
        u = s.user
        old = f"{u.first_name} {u.last_name}".strip()
        new = get_clean_name(u.first_name, u.last_name)
        if old != new:
            print(f"Old: '{old}' -> New: '{new}'")

if __name__ == '__main__':
    test()
