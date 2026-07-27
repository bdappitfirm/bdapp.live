import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result
from results.utils import _class_group

rs = Result.objects.filter(subject__name__icontains='কৃষি') | Result.objects.filter(subject__name__icontains='গার্হস্থ্য')
count = 0
for r in rs:
    if r.student.classroom and _class_group(r.student.classroom.name) == 'six_to_eight':
        r.save()
        count += 1
print(f"Updated {count} Agriculture/Home Economics results for Class 6-8.")
