import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import StudentProfile

def check():
    students = StudentProfile.objects.select_related('user').filter(
        models.Q(user__first_name__icontains='islam') |
        models.Q(user__last_name__icontains='islam') |
        models.Q(user__first_name__icontains='hossain') |
        models.Q(user__last_name__icontains='hossain')
    ) if hasattr(StudentProfile.objects, 'filter') else []

    # Using Q properly
    from django.db.models import Q
    students = StudentProfile.objects.select_related('user').filter(
        Q(user__first_name__icontains='islam') |
        Q(user__last_name__icontains='islam') |
        Q(user__first_name__icontains='hossain') |
        Q(user__last_name__icontains='hossain') |
        Q(user__first_name_en__icontains='islam') |
        Q(user__last_name_en__icontains='islam')
    )

    print(f"Found {students.count()} students:")
    for s in students[:10]:
        u = s.user
        print(f"ID: {s.id}, FN: '{u.first_name}', LN: '{u.last_name}', EN: '{u.first_name_en}' '{u.last_name_en}'")

if __name__ == '__main__':
    check()
