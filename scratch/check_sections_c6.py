from academics.models import ClassRoom, Section, StudentProfile
from django.db.models import Count

c6 = ClassRoom.objects.get(id=208)
print('Classroom 208:', c6.name, c6.school_id)

secs = Section.objects.filter(classroom_id=208)
print('Sections explicitly under classroom 208:', list(secs.values('id', 'name')))

# Let's check all sections in school 57
all_secs = Section.objects.filter(classroom__school_id=57)
print('All sections in school 57:', list(all_secs.values('id', 'name', 'classroom_id', 'classroom__name')))

# Let's check sections assigned to students in classroom 208
st_secs = StudentProfile.objects.filter(school_id=57, classroom_id=208).values('section_id', 'section__name').annotate(cnt=Count('id'))
print('Student sections in classroom 208:', list(st_secs))
