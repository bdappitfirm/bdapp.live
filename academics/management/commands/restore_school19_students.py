
import os
import json
from django.core.management.base import BaseCommand
from django.conf import settings
from academics.models import StudentProfile
from schools.models import School
from users.models import User


class Command(BaseCommand):
    help = 'Restore School 19 students from local export file'

    def add_arguments(self, parser):
        parser.add_argument('--file', type=str, default='school_19_students.json', help='Path to JSON export file')
        parser.add_argument('--force', action='store_true', help='Force restore even if already done')

    def handle(self, *args, **kwargs):
        file_path = kwargs['file']
        force = kwargs['force']
        
        # Check if we already did restore
        marker_file = os.path.join(os.path.dirname(__file__), '.school19_restored')
        if os.path.exists(marker_file) and not force:
            self.stdout.write("School 19 students already restored! Use --force to re-run.")
            return

        if not os.path.exists(file_path):
            self.stderr.write(f"File not found: {file_path}")
            return

        school = School.objects.get(id=19)
        self.stdout.write(f"Restoring students for {school.name} (ID: {school.id})")
        self.stdout.write(f"Current student count: {StudentProfile.objects.filter(school=school).count()}")

        with open(file_path, 'r', encoding='utf-8') as f:
            student_data_list = json.load(f)

        self.stdout.write(f"Total students in export: {len(student_data_list)}")

        restored_count = 0
        skipped_count = 0

        for student_data in student_data_list:
            # Check if student profile already exists
            existing_profile = StudentProfile.objects.filter(id=student_data['id']).first()

            user_data = student_data.get('user')
            user = None

            if user_data:
                # Try to get or create User
                user, created = User.objects.get_or_create(
                    id=user_data['id'],
                    defaults={
                        'username': user_data['username'],
                        'first_name': user_data['first_name'],
                        'last_name': user_data['last_name'],
                        'email': user_data['email'],
                        'phone_number': user_data['phone_number'],
                        'photo': user_data.get('photo'),
                        'thumbnail': user_data.get('thumbnail'),
                        'is_active': user_data['is_active'],
                    }
                )
                if not created:
                    # Update user data (especially photo) if it's missing or force is on
                    if force or not user.photo:
                        user.username = user_data['username']
                        user.first_name = user_data['first_name']
                        user.last_name = user_data['last_name']
                        user.email = user_data['email']
                        user.phone_number = user_data['phone_number']
                        user.photo = user_data.get('photo')
                        user.thumbnail = user_data.get('thumbnail')
                        user.is_active = user_data['is_active']
                        user.save()

            if existing_profile and not force:
                skipped_count +=1
                continue

            # Create or Update StudentProfile
            profile_defaults = {
                'user': user,
                'school': school,
                'classroom_id': student_data['classroom_id'],
                'section_id': student_data['section_id'],
                'roll_number': student_data['roll_number'],
                'student_group': student_data.get('group'),
                'gender': student_data['gender'],
                'student_custom_id': student_data['student_custom_id'],
                'guardian_name': student_data['guardian_name'],
                'father_name': student_data['father_name'],
                'mother_name': student_data['mother_name'],
                'admission_date': student_data['admission_date'],
                'address': student_data['address'],
                'remarks': student_data['remarks'],
                'voter_number': student_data['voter_number'],
            }

            if existing_profile:
                for attr, value in profile_defaults.items():
                    setattr(existing_profile, attr, value)
                existing_profile.save()
                restored_count += 1
            elif user:
                StudentProfile.objects.create(id=student_data['id'], **profile_defaults)
                restored_count += 1

        final_count = StudentProfile.objects.filter(school=school).count()
        self.stdout.write(f"\nDone! Restored {restored_count}, skipped {skipped_count}")
        self.stdout.write(f"Final student count for school 19: {final_count}")

        # Create marker file
        with open(marker_file, 'w') as f:
            f.write('1')

