
import os
import django
import sys

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from users.models import Profile
from schools.models import School

User = get_user_model()

def assign_admin(username, school_id):
    try:
        user = User.objects.get(username=username)
        school = School.objects.get(id=school_id)
        
        profile, created = Profile.objects.get_or_create(user=user, defaults={'school': school, 'role': 'admin'})
        if not created:
            profile.role = 'admin'
            profile.school = school
            profile.save()
        
        # Also ensure they have staff access to be safe
        user.is_staff = True
        user.save()
        
        print(f"Successfully assigned {username} as Admin for School {school_id} ({school.name})")
    except User.DoesNotExist:
        print(f"User {username} not found")
    except School.DoesNotExist:
        print(f"School {school_id} not found")
    except Exception as e:
        print(f"Error assigning {username}: {e}")

if __name__ == "__main__":
    # School 16 Admins
    assign_admin('samir', 16)
    assign_admin('umor', 16)
    
    # School 19 Admins
    assign_admin('imam', 19)
