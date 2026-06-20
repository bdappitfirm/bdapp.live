from django.core.management.base import BaseCommand
from academics.models import StudentProfile
from academics.number_utils import bengali_to_english_number


class Command(BaseCommand):
    help = 'Convert all student roll numbers from Bengali to English numerals'

    def handle(self, *args, **options):
        print('Starting roll number conversion...')

        # Get all student profiles
        students = StudentProfile.objects.select_related('user').all()
        print(f'Found {students.count()} student profiles.')

        updated_count = 0

        for student in students:
            if student.roll_number:
                # Convert to English numerals
                converted_roll = bengali_to_english_number(student.roll_number)
                if converted_roll != student.roll_number:
                    student.roll_number = converted_roll
                    # Regenerate custom ID if needed
                    student.student_custom_id = student.generate_custom_id()
                    student.save()
                    updated_count += 1
                    try:
                        print(f'Updated {student.user.username}: {student.roll_number}')
                    except UnicodeEncodeError:
                        print(f'Updated student ID {student.id}: {student.roll_number}')

        print(f'Success! Converted {updated_count} roll numbers.')
