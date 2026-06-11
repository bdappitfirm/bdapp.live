from django.core.management.base import BaseCommand
from django.db.models import Q
from users.models import User, Profile
from schools.models import School


class Command(BaseCommand):
    help = 'Make a user an admin of a specific school'

    def add_arguments(self, parser):
        parser.add_argument('--school-id', type=int, help='ID of the school')
        parser.add_argument('--phone', type=str, help='Phone number of the user')
        parser.add_argument('--username', type=str, help='Username of the user')
        parser.add_argument('--name', type=str, help='Name of the user (first or last)')

    def handle(self, *args, **options):
        school_id = options['school_id']
        phone = options['phone']
        username = options['username']
        name = options['name']

        # Find school
        try:
            school = School.objects.get(id=school_id)
            self.stdout.write(self.style.SUCCESS(f'Found school: {school.name} (ID: {school.id})'))
        except School.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'School with ID {school_id} not found!'))
            return

        # Find user
        user = None

        if username:
            user = User.objects.filter(username__iexact=username).first()
        elif phone:
            user = User.objects.filter(phone_number=phone).first()
        elif name:
            user = User.objects.filter(
                Q(first_name__icontains=name) | Q(last_name__icontains=name)
            ).first()

        if not user:
            self.stdout.write(self.style.ERROR('User not found!'))
            self.stdout.write('Please provide one of: --username, --phone, or --name')
            return

        self.stdout.write(f'Found user: {user.username} ({user.get_full_name()})')

        # Get or create profile
        profile, created = Profile.objects.get_or_create(user=user)
        
        if created:
            self.stdout.write(self.style.SUCCESS('Created new profile for user'))
        else:
            self.stdout.write(f'Found existing profile. Current role: {profile.role}, Current school: {profile.school}')

        # Update profile
        profile.school = school
        profile.role = 'admin'
        profile.save()

        self.stdout.write(self.style.SUCCESS('\n✅ Successfully updated profile!'))
        self.stdout.write(f'   School: {profile.school.name} (ID: {profile.school.id})')
        self.stdout.write(f'   Role: {profile.role}')
