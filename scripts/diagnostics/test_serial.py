import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from attendance.models import AttendanceRecord
from attendance.serializers import AttendanceRecordSerializer

def test():
    records = AttendanceRecord.objects.all()[:10]
    for r in records:
        try:
            data = AttendanceRecordSerializer(r).data
            print(f"Serialized record {r.id}")
        except Exception as e:
            print(f"Failed to serialize record {r.id}: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test()
