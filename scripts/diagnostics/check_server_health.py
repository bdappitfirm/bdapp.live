import os
import django
import sys

# Set stdout to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection
from schools.models import School

def check_health():
    print("--- Server Health Check ---")
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        print("✅ Database: Connected")
    except Exception as e:
        print(f"❌ Database: Error - {e}")

    try:
        count = School.objects.count()
        print(f"✅ Schools Count: {count}")
    except Exception as e:
        print(f"❌ Schools Query: Error - {e}")

    print("--- Process Check ---")
    import subprocess
    gunicorn = subprocess.run(['pgrep', 'gunicorn'], capture_output=True)
    if gunicorn.returncode == 0:
        print("✅ Gunicorn: Running")
    else:
        print("❌ Gunicorn: Not Running")

if __name__ == "__main__":
    check_health()
