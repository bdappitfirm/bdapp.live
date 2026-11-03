from .models import ActivityLog

def get_client_ip(request):
    if not request:
        return None
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def log_activity(user, school, action_type, details=None, cost=0.00, ip_address=None):
    try:
        from schools.models import School
        if isinstance(school, (int, str)) and str(school).isdigit():
            school = School.objects.filter(pk=int(school)).first()

        if not school and user and hasattr(user, 'profile') and user.profile.school:
            school = user.profile.school

        if not school:
            school = School.objects.filter(pk=6).first() or School.objects.first()

        if not school:
            return None

        active_user = user if (user and hasattr(user, 'is_authenticated') and user.is_authenticated) else None

        return ActivityLog.objects.create(
            user=active_user,
            school=school,
            action_type=action_type,
            details=details or {},
            ip_address=ip_address,
            cost=cost
        )
    except Exception as e:
        print(f"Error logging activity: {e}")
        return None
