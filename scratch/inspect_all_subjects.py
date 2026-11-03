import os
import sys
import django

sys.path.insert(0, 'F:/bdedu')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import Subject, ClassRoom, Section, TeacherAssignment, StudentProfile
from results.models import Result, Examination
from django.db.models import Count

print("=== SUBJECT ANALYSIS ===")
total_subjects = Subject.objects.count()
print(f"Total Subject records: {total_subjects}")

# Custom subjects check
custom_keywords = ['আরবী', 'আরবি', 'বই পড়া', 'বইপড়া', 'word collection', 'achievement test']
custom_subjects = []
for kw in custom_keywords:
    found = list(Subject.objects.filter(name__icontains=kw))
    custom_subjects.extend(found)
    print(f"Keyword '{kw}': {len(found)} subjects found")

# Distinct subject names
all_names = list(Subject.objects.values_list('name', flat=True).distinct())
print(f"\nTotal distinct subject names across all schools: {len(all_names)}")
print("Sample subject names:", all_names[:30])

# References
ta_count = TeacherAssignment.objects.count()
res_count = Result.objects.count()
opt_count = StudentProfile.objects.filter(optional_subject__isnull=False).count()

print(f"\nReferences count:")
print(f"  TeacherAssignments: {ta_count}")
print(f"  Results: {res_count}")
print(f"  StudentProfile optional_subject: {opt_count}")

# Check for subjects with no classrooms or sections linked
orphaned = Subject.objects.filter(classrooms__isnull=True, sections__isnull=True).count()
print(f"  Subjects with no classroom or section: {orphaned}")
