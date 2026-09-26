import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

def check():
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT student_id, date, count(*)
            FROM attendance_attendancerecord
            GROUP BY student_id, date
            HAVING count(*) > 1;
        """)
        rows = cursor.fetchall()
        if rows:
            print(f"Found duplicates: {rows}")
        else:
            print("No duplicates found.")

if __name__ == "__main__":
    check()
