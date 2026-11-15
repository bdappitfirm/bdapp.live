import os, sys, django, json
from collections import defaultdict
sys.path.insert(0, os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result

rows = defaultdict(list)
qs = Result.objects.filter(examination_id=1689, student__classroom_id=133).select_related('subject')
for r in qs:
    rows[str(r.student_id)].append({
        'subject_name': r.subject.name,
        'written_marks': None if r.written_marks is None else str(r.written_marks),
        'mcq_marks': None if r.mcq_marks is None else str(r.mcq_marks),
        'practical_marks': None if r.practical_marks is None else str(r.practical_marks),
        'total_obtained': str(r.total_obtained) if r.total_obtained is not None else None,
    })

with open('scratch/_rows1689.json', 'w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False)
print('dumped students:', len(rows))
