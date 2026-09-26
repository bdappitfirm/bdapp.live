import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result
from results.utils import _class_group

def recalculate_primary():
    print("🔄 Recalculating all primary results in the database...")
    count = 0
    results = Result.objects.all().select_related('examination__classroom', 'subject')
    for r in results.iterator():
        cls_name = getattr(r.examination.classroom, 'name', None) if r.examination and r.examination.classroom else None
        if _class_group(cls_name) == 'primary':
            r.save()
            count += 1
    print(f"🏁 Recalculation complete. Total primary results re-saved: {count}")

if __name__ == '__main__':
    recalculate_primary()
