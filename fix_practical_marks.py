import os
import django
from decimal import Decimal
from django.db.models import Q

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result
from academics.models import Subject

def fix_practical_marks():
    print("--- Starting Practical Marks Fix ---")

    # Define keywords for subjects that have practical exams
    practical_subject_keywords = [
        'আইসিটি', 'ict', 'তথ্য ও যোগাযোগ', 'information and communication',
        'পদার্থ', 'physics',
        'রসায়ন', 'chemistry',
        'জীব', 'biology',
        'উচ্চতর', 'higher',
        'কৃষি', 'agri',
        'গার্হস্থ্য', 'home science'
    ]

    # Get relevant subjects
    subjects = Subject.objects.all()
    practical_subjects = []
    for sub in subjects:
        name_low = sub.name.lower()
        if any(keyword in name_low for keyword in practical_subject_keywords):
            practical_subjects.append(sub)

    subject_ids = [s.id for s in practical_subjects]
    print(f"Found {len(practical_subjects)} subjects with practicals.")

    # Find results where written AND/OR mcq have data, but practical is missing or zero
    # The user example '9 = 9+0+0' shows MCQ as 0 and PR as 0.
    # We update if PR is exactly 0 or None, but at least one of Written/MCQ has data.
    results_to_update = Result.objects.filter(
        subject_id__in=subject_ids
    ).filter(
        # Written OR MCQ must have data (not None)
        Q(written_marks__isnull=False) | Q(mcq_marks__isnull=False)
    ).filter(
        # Practical must be missing (None) or explicitly 0
        Q(practical_marks__isnull=True) | Q(practical_marks=0)
    )

    count = results_to_update.count()
    print(f"Found {count} result records to update.")

    updated_count = 0
    for res in results_to_update:
        # Check if it already has a non-zero total including a potential practical input
        # But the user specifically said "প্রাকটিক্যালে ডাটা ইনপুট নাই"
        # In their example 9=9+0+0, it's clear PR is 0 and they want it to be 20.

        res.practical_marks = Decimal('20.00')
        # We must call save() to trigger Result.save() logic which updates total_obtained, grade, gpa etc.
        res.save()
        updated_count += 1

    print(f"Successfully updated {updated_count} records.")
    print("--- Practical Marks Fix Completed ---")

if __name__ == "__main__":
    fix_practical_marks()
