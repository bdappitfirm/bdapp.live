from .models import ActivityLog

def log_activity(user, school, action_type, details=None, cost=0.00):
    try:
        ActivityLog.objects.create(
            user=user,
            school=school,
            action_type=action_type,
            details=details or {},
            cost=cost
        )
    except Exception as e:
        print(f"Error logging activity: {e}")
