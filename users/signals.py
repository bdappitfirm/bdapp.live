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
    if created and instance.role in ['teacher', 'admin']:
        log_activity(
            user=instance.user,
            school=instance.school_id or getattr(instance.school, 'id', None),
            action_type='teacher_create',
            details={
                'role': instance.role,
                'action_label': 'নতুন শিক্ষক যোগ',
                'username': instance.user.username if instance.user else '',
                'name': instance.user.get_full_name() if instance.user else ''
            },
            cost=5.00
        )

@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    school_val = getattr(getattr(user, 'profile', None), 'school', None) or getattr(getattr(user, 'profile', None), 'school_id', None)
    if school_val:
        log_activity(
            user=user,
            school=school_val,
            action_type='login',
            details={'ip': request.META.get('REMOTE_ADDR')},
            cost=0.00
        )

@receiver(post_save, sender='academics.StudentProfile')
def log_student_profile_creation(sender, instance, created, **kwargs):
    if created:
        school_val = instance.school or instance.school_id
        student_name = instance.user.get_full_name() if instance.user else ''
        if not student_name and instance.user:
            student_name = instance.user.username

        from users.models import ActivityLog
        from django.utils import timezone
        import datetime
        now = timezone.now()
        recent_exists = ActivityLog.objects.filter(
            details__name=student_name,
            timestamp__gte=now - datetime.timedelta(seconds=10)
        ).exists()

        if not recent_exists:
            log_activity(
                user=instance.user,
                school=school_val,
                action_type='student_create',
                details={
                    'action': 'student_create',
                    'action_label': 'নতুন শিক্ষার্থী ভর্তি/যোগ',
                    'role': 'student',
                    'username': instance.user.username if instance.user else '',
                    'name': student_name,
                    'roll': instance.roll_number or '',
                    'class': instance.classroom.name if instance.classroom else 'N/A',
                    'section': instance.section.name if instance.section else ''
                },
                cost=5.00
            )
