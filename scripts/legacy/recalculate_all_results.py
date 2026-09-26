import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result

def recalculate():
    print("🔄 Recalculating all result records...")
    results = Result.objects.all().iterator()
    count = 0
    for r in results:
        r.save()
        count += 1
        if count % 500 == 0:
            print(f"Processed {count} results...")
    print(f"🏁 Recalculation complete. Total results processed: {count}")

if __name__ == '__main__':
    recalculate()
