import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import Profile
from users.serializers import TeacherProfileSerializer

def test():
    p = Profile.objects.get(pk=5712)
    data = {'gender': 'female', 'first_name': p.user.first_name}
    serializer = TeacherProfileSerializer(p, data=data, partial=True)
    if serializer.is_valid():
        serializer.save()
        print("Updated successfully!")
    else:
        print("Errors:", serializer.errors)

if __name__ == '__main__':
    test()
