from users.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@bdapp.live', 'Bangladesh@4321$')
    print('Superuser created successfully')
else:
    print('Superuser already exists')
