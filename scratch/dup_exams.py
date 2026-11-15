import os, sys, django
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db.models import Count
from results.models import Examination, Result, StudentOverallResult

groups = (Examination.objects.values('school_id', 'classroom_id', 'year', 'exam_type')
          .annotate(n=Count('id')).filter(n__gt=1))
for g in groups:
    qs = Examination.objects.filter(school_id=g['school_id'], classroom_id=g['classroom_id'],
                                    year=g['year'], exam_type=g['exam_type']).order_by('id')
    print(f"--- school={g['school_id']} classroom={g['classroom_id']} year={g['year']} type={g['exam_type']!r}")
    for ex in qs:
        rc = Result.objects.filter(examination_id=ex.id).count()
        oc = StudentOverallResult.objects.filter(examination_id=ex.id).count()
        print(f"      id={ex.id} name={ex.name!r} results={rc} overalls={oc}")
