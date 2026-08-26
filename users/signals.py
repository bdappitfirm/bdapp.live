from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from django.contrib.auth.signals import user_logged_in

from .models import Profile, User
from .utils import log_activity


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def save_user_profile(sender, instance, created, **kwargs):
    """
    Ensure a profile exists for every user and is kept in sync.
    We use a flag on the instance to avoid recursion during save.
    """
    if created:
        Profile.objects.get_or_create(user=instance)

    # Avoid recursion if we're already saving this profile
    if getattr(instance, '_saving_profile', False):
        return

    try:
        instance._saving_profile = True
        if hasattr(instance, 'profile'):
            instance.profile.save()
        else:
            Profile.objects.get_or_create(user=instance)
    except Exception as e:
        print(f"Error saving user profile: {e}")
    finally:
        instance._saving_profile = False

@receiver(post_save, sender=Profile)
def log_profile_creation(sender, instance, created, **kwargs):
    if created and instance.school and instance.school.id == 6 and instance.role in ['teacher']:
        # Profile cost is 0.00 TK
        log_activity(
            user=instance.user,
            school=instance.school,
            action_type='profile_create',
            details={
                'role': instance.role,
                'username': instance.user.username,
                'name': f"{instance.user.first_name} {instance.user.last_name}".strip()
            },
            cost=0.00
        )

@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    if hasattr(user, 'profile') and user.profile.school:
        log_activity(
            user=user,
            school=user.profile.school,
            action_type='login',
            details={'ip': request.META.get('REMOTE_ADDR')},
            cost=0.00
        )

# Use string based registration to avoid circular import if needed, 
# or just import inside the receiver
@receiver(post_save, sender='academics.StudentProfile')
def log_student_profile_creation(sender, instance, created, **kwargs):
    if created and instance.school and instance.school.id == 6:
        log_activity(
            user=instance.user,
            school=instance.school,
            action_type='profile_create',
            details={
                'role': 'student',
                'username': instance.user.username,
                'name': f"{instance.user.first_name} {instance.user.last_name}".strip(),
                'roll': instance.roll_number,
                'class': instance.classroom.name if instance.classroom else 'N/A'
            },
            cost=0.00
        )
