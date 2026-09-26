import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

def check():
    with connection.cursor() as cursor:
        cursor.execute("SELECT count(*) FROM attendance_attendancerecord WHERE operator_log IS NULL;")
        null_count = cursor.fetchone()[0]
        print(f"Records with NULL operator_log: {null_count}")

        if null_count > 0:
            print("Fixing NULL operator_log...")
            cursor.execute("UPDATE attendance_attendancerecord SET operator_log = '{}' WHERE operator_log IS NULL;")
            print("Fixed.")

if __name__ == "__main__":
    check()
