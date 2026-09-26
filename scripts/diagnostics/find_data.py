import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth.models import User
from schools.models import School
from academics.models import StudentProfile, ClassRoom, Section, Subject
from results.models import Result, Examination
from datetime import datetime, timedelta

def find_teacher_and_school():
    print("--- Searching for Teacher and School ---")
    teachers = User.objects.filter(username__icontains='said')
    for t in teachers:
        print(f"Teacher Found: ID={t.id}, Username={t.username}, Name={t.first_name} {t.last_name}")
        profile = getattr(t, 'profile', None)
        if profile:
            school = profile.school
            if school:
                print(f"  Associated School: ID={school.id}, Name={school.name}")
            else:
                print("  No school associated in profile.")
        else:
            print("  No profile found for this user.")

    # Search for Bohera school
    schools = School.objects.filter(name__icontains='বহেরা') | School.objects.filter(name__icontains='Bohera')
    for s in schools:
        print(f"School Found: ID={s.id}, Name={s.name}")

def check_results():
    print("\n--- Checking Results entered around last Wednesday ---")
    # Last Wednesday was July 29, 2026 (assuming today is Friday July 31, 2026 based on logs in user prompt)
    # The user said "last Wednesday" which would be July 29th.

    start_date = datetime(2026, 7, 29, 0, 0)
    end_date = datetime(2026, 7, 29, 23, 59)

    results = Result.objects.filter(created_at__range=(start_date, end_date))
    print(f"Total results found for July 29, 2026: {results.count()}")

    # Filter by Mathematics (গণিত)
    math_results = results.filter(subject__name__icontains='গণিত') | results.filter(subject__name__icontains='Math')
    print(f"Mathematics results found for July 29, 2026: {math_results.count()}")

    for r in math_results[:10]:
        print(f"Result: ID={r.id}, Student={r.student.user.username}, Subject={r.subject.name}, Marks={r.total_obtained}, School={r.student.school.name}")

if __name__ == "__main__":
    find_teacher_and_school()
    check_results()
