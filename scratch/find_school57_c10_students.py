import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import ClassRoom, StudentProfile

print('All classrooms in school 57:')
for cr in ClassRoom.objects.filter(school_id=57):
    print(cr.id, cr.name, StudentProfile.objects.filter(school_id=57, classroom=cr).count())

# Let's check students whose classroom is null or if there are any other students
null_classroom = StudentProfile.objects.filter(school_id=57, classroom__isnull=True).count()
print('Students with null classroom in school 57:', null_classroom)

# Let's check if there are any students with classroom name containing দশম or 10
other_c10 = StudentProfile.objects.filter(school_id=57, user__first_name__icontains='দশম')
print('Students matching দশম in name:', other_c10.count())

# Let's check recent student profiles or all students in school 57
all_st = StudentProfile.objects.filter(school_id=57)
print('Total students in school 57:', all_st.count())
