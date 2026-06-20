from django.core.management.base import BaseCommand
from academics.utils import update_student_genders
from schools.models import School

class Command(BaseCommand):
    help = "Update student genders based on their names"

    def add_arguments(self, parser):
        parser.add_argument(
            '--school',
            type=int,
            help='School ID to update (optional, updates all if not provided)'
        )

    def handle(self, *args, **options):
        school_id = options['school']
        if school_id:
            try:
                school = School.objects.get(id=school_id)
                updated = update_student_genders(school=school)
                self.stdout.write(self.style.SUCCESS(f"Updated {updated} students for school {school.name}!"))
            except School.DoesNotExist:
                self.stdout.write(self.style.ERROR("School not found!"))
        else:
            updated = update_student_genders()
            self.stdout.write(self.style.SUCCESS(f"Updated {updated} students in total!"))
