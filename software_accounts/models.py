from django.db import models
from django.utils import timezone
from schools.models import School

class SoftwareIncome(models.Model):
    SCHOOL_INCOME_TYPES = [
        ('monthly', 'Monthly Subscription'),
        ('yearly', 'Yearly Subscription'),
        ('one_time', 'One-time Setup Fee'),
        ('other', 'Other Income'),
    ]

    school = models.ForeignKey(School, on_delete=models.SET_NULL, null=True, blank=True, related_name='software_incomes')
    title = models.CharField(max_length=255, default='Software Fee')
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    income_date = models.DateField(default=timezone.now)
    payment_method = models.CharField(max_length=50, default='bKash', choices=[
        ('bKash', 'bKash'),
        ('Nagad', 'Nagad'),
        ('Bank', 'Bank Transfer'),
        ('Cash', 'Cash'),
        ('Other', 'Other')
    ])
    income_type = models.CharField(max_length=50, default='monthly', choices=SCHOOL_INCOME_TYPES)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-income_date', '-id']

    def __str__(self):
        school_name = self.school.name if self.school else 'General'
        return f"{school_name} - {self.title} ({self.amount} BDT)"


class FirmExpense(models.Model):
    EXPENSE_CATEGORIES = [
        ('vps', 'VPS & Server (ভিপিএস)'),
        ('internet', 'Internet Bill (ইন্টারনেট)'),
        ('office_rent', 'Office Rent (অফিসভাড়া)'),
        ('electricity', 'Electricity Bill (বিদ্যুৎ বিল)'),
        ('salary', 'Staff/Officer Salary (বেতন)'),
        ('ta_da', 'TA & DA (টিএ ও ডিএ)'),
        ('bonus', 'Bonus (বোনাস)'),
        ('other', 'Other Expenses (অন্যান্য ব্যয়)'),
    ]

    category = models.CharField(max_length=50, default='other', choices=EXPENSE_CATEGORIES)
    title = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    expense_date = models.DateField(default=timezone.now)
    paid_to = models.CharField(max_length=255, blank=True, null=True, help_text="Paid to (Landlord, ISP, Employee, etc.)")
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-expense_date', '-id']

    def __str__(self):
        return f"{self.get_category_display()} - {self.title} ({self.amount} BDT)"
