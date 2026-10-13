import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import ClassRoom, Section, StudentProfile

c10 = ClassRoom.objects.filter(id=211).first()
if c10:
    print('Classroom 211:', c10.name, 'School:', c10.school_id)
    st_count = StudentProfile.objects.filter(school_id=57, classroom_id=211).count()
    print('Students in classroom 211 count:', st_count)

    # Check all students in school 57 grouped by classroom
    from django.db.models import Count
    breakdown = StudentProfile.objects.filter(school_id=57).values('classroom_id', 'classroom__name').annotate(cnt=Count('id'))
    print('Students per classroom in school 57:', list(breakdown))
else:
    print('Classroom 211 not found!')

# Let's check sections of classroom 211
secs = Section.objects.filter(classroom_id=211)
print('Sections of classroom 211:', list(secs.values('id', 'name')))
