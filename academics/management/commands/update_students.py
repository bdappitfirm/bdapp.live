from django.core.management.base import BaseCommand
from academics.models import StudentProfile
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Generate custom IDs for all students and reset passwords to 12345678'

    def handle(self, *args, **options):
        self.stdout.write('Starting student update...')

        # Get all student profiles
        students = StudentProfile.objects.select_related('user', 'classroom', 'section').all()
        self.stdout.write(f'Found {students.count()} student profiles.')

        updated_count = 0
        password_updated_count = 0
        skipped_no_info = 0

        for student in students:
            # Regenerate custom ID
            custom_id = student.generate_custom_id()
            if custom_id:
                if custom_id != student.student_custom_id:
                    student.student_custom_id = custom_id
                    student.save(update_fields=['student_custom_id'])
                    updated_count += 1
                    self.stdout.write(self.style.SUCCESS(f'Updated {student.user.username} to ID: {custom_id}'))
            else:
                skipped_no_info += 1
                self.stdout.write(self.style.WARNING(f'Skipping {student.user.username} (missing gender/class/roll)'))

            # Reset password to 12345678
            try:
                user = student.user
                if user:
                    user.set_password('12345678')
                    user.save(update_fields=['password'])
                    password_updated_count += 1
            except Exception as e:
                self.stderr.write(self.style.ERROR(f'Error updating password for {getattr(student.user, "username", "unknown")}: {e}'))

        self.stdout.write(self.style.SUCCESS(f'Success!'))
        self.stdout.write(f'  - Updated {updated_count} custom IDs')
        self.stdout.write(f'  - Updated {password_updated_count} passwords')
        self.stdout.write(f'  - Skipped {skipped_no_info} students (missing info)')
