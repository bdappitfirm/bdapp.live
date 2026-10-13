from academics.models import ClassRoom, Section, StudentProfile
from django.db.models import Count

c = ClassRoom.objects.filter(school_id=57)
print('Classrooms count:', c.count())
for cr in c:
    if '6' in cr.name or 'ষষ্ঠ' in cr.name:
        print('Classroom:', cr.id, cr.name)

secs = Section.objects.filter(classroom__school_id=57)
print('Sections count:', secs.count())
for s in secs:
    print('Section:', s.id, s.name, 'classroom_id:', s.classroom_id)

students = StudentProfile.objects.filter(school_id=57)
print('Total students school 57:', students.count())
for cr in c:
    if '6' in cr.name or 'ষষ্ঠ' in cr.name:
        st_count = StudentProfile.objects.filter(school_id=57, classroom_id=cr.id).count()
        print(f'Classroom {cr.id} ({cr.name}) students count: {st_count}')
        break
