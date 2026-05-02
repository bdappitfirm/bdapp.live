
import os
import django
import sys

# Add current directory to path
sys.path.append(os.getcwd())

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

default_users = ['shankari', 'najmul', 'sekentar', 'taslim', 'nasir']
password = '12345678'

args = sys.argv[1:]
if args:
    if args[0] in ('-h', '--help'):
        print("Usage:")
        print("  python scripts/reset_teacher_passwords.py")
        print("  python scripts/reset_teacher_passwords.py nasir")
        print("  python scripts/reset_teacher_passwords.py nasir --password 12345678")
        print("  python scripts/reset_teacher_passwords.py --password 12345678 nasir")
        raise SystemExit(0)

    if args[0] == '--password' and len(args) >= 2:
        password = args[1]
        users = args[2:] or default_users
    else:
        if '--password' in args:
            i = args.index('--password')
            if i + 1 < len(args):
                password = args[i + 1]
            users = [u for j, u in enumerate(args) if j not in (i, i + 1)]
            users = users or default_users
        else:
            users = args
else:
    users = default_users

# Handle potential Zero Width Joiner (\u200d) prefix in usernames
users_with_zwj = [f'\u200d{u}' for u in users]
all_usernames = users + users_with_zwj

updated = []

for u in all_usernames:
    try:
        user = User.objects.get(username=u)
        user.set_password(password)
        user.save()
        updated.append(u)
        print(f"Password reset for: {repr(u)}")
    except User.DoesNotExist:
        pass

print(f"\nSuccessfully updated {len(updated)} users.")
for u in updated:
    print(f"- {repr(u)}")
