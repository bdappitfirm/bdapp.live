from django.core.management.base import BaseCommand
from academics.models import StudentProfile
from schools.models import School
from users.models import Profile
from django.contrib.auth import get_user_model
import re
import unicodedata

User = get_user_model()

class Command(BaseCommand):
    help = "Link existing students to father and mother profiles using father_name and mother_name"
    requires_migrate = False

    def add_arguments(self, parser):
        pass

    def handle(self, *args, **options):
        print("Starting to link existing students to their parents...")

        total_students = StudentProfile.objects.all()
        linked_father_count = 0
        linked_mother_count = 0

        for student in total_students:
            # Try to get/create father if we have father_name
            if student.father_name and not student.father:
                name_clean = str(student.father_name).strip()
                parts = name_clean.split()
                first = parts[0] if parts else 'Parent'
                last = ' '.join(parts[1:]) if len(parts) > 1 else ''

                name_slug = re.sub(r'[^a-z0-9]', '', name_clean.lower().replace(' ', '')) or 'parent'
                # Try to find by username first
                unique_base = f"p_{student.school.id}_{name_slug}_father"
                father_user = User.objects.filter(username__iexact=unique_base).first()
                if not father_user:
                    # Try to find by name in the user's first and last
                    query = User.objects.filter(
                        first_name__iexact=first)
                    query = query.filter(last_name__iexact=last) if last else query
                    # Check if they are a parent at this school
                    query = query.filter(profile__school=student.school, profile__role='parent')
                    father_user = query.first()

                if father_user:
                    student.father = father_user
                    student.save(update_fields=['father'])
                    linked_father_count +=1
                    print(f"Linked father for student {student.user.username}")

            # Do the same for mother
            if student.mother_name and not student.mother:
                name_clean = str(student.mother_name).strip()
                parts = name_clean.split()
                first = parts[0] if parts else 'Parent'
                last = ' '.join(parts[1:]) if len(parts) > 1 else ''

                name_slug = re.sub(r'[^a-z0-9]', '', name_clean.lower().replace(' ', '')) or 'parent'
                unique_base = f"p_{student.school.id}_{name_slug}_mother"
                mother_user = User.objects.filter(username__iexact=unique_base).first()
                if not mother_user:
                    query = User.objects.filter(first_name__iexact=first)
                    query = query.filter(last_name__iexact=last) if last else query
                    query = query.filter(profile__school=student.school, profile__role='parent')
                    mother_user = query.first()

                if mother_user:
                    student.mother = mother_user
                    student.save(update_fields=['mother'])
                    linked_mother_count +=1
                    print(f"Linked mother for student {student.user.username}")

        print(f"Done! Linked {linked_father_count} fathers and {linked_mother_count} mothers!")
