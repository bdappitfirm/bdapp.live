import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

def check():
    with connection.cursor() as cursor:
        cursor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance_attendancerecord';")
        columns = [row[0] for row in cursor.fetchall()]
        print(f"Columns in attendance_attendancerecord: {columns}")

if __name__ == "__main__":
    check()
