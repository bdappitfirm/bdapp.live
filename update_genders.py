
import os
import django

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from academics.utils import update_student_genders

print("Updating student genders...")
updated_count = update_student_genders()
print(f"Successfully updated {updated_count} students with predicted gender!")
