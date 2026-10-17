import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()
u = User.objects.filter(username='mdabdul1122').first()
if u:
    u.set_password('12345678')
    u.is_active = True
    u.save()
    print("SUCCESS: Password reset to 12345678 for mdabdul1122")
else:
    print("ERROR: User mdabdul1122 not found")
