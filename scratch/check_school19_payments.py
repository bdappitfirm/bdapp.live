import os
import sys
import django

sys.path.insert(0, 'F:/bdedu')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from fees.models import Payment

school_19 = School.objects.filter(id=19).first()
if school_19:
    print(f"=== SCHOOL 19 PAYMENTS IN DB ===")
    payments = Payment.objects.filter(student__school=school_19)
    print(f"Total Payments for School 19: {payments.count()}")
    for p in payments.order_by('-id')[:20]:
        print(f"  ID {p.id}: Date: {p.payment_date} | Amount: {p.amount} | Status: {p.payment_status} | Student ID: {p.student_id} ({p.student.user.username if p.student and p.student.user else 'N/A'})")
