"""Employee Management models for the BDapp IT Firm module.

The module is intentionally structured so that Attendance, Leave Management and
Payroll can be attached to :class:`Employee` in the future:

* ``Employee`` keeps the joining date, employment type, reporting manager,
  department and designation so attendance/leave/payroll records can simply
  point to ``Employee`` via a ForeignKey.
* ``Employee.user`` optionally links a BDapp login account.
"""
from django.conf import settings
from django.db import models
from schools.models import School


class Department(models.Model):
    """A department of a school / firm (e.g. Software Development)."""

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='employee_departments')
    name = models.CharField(max_length=150)
    name_bn = models.CharField(max_length=150, blank=True, null=True, verbose_name='Name (Bangla)')
    code = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        unique_together = ('school', 'name')

    def __str__(self):
        return f"{self.name} - {self.school_id}"


class Designation(models.Model):
    """A designation that always belongs to a department."""

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='employee_designations')
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='designations'
    )
    name = models.CharField(max_length=150)
    name_bn = models.CharField(max_length=150, blank=True, null=True, verbose_name='Name (Bangla)')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        unique_together = ('school', 'department', 'name')

    def __str__(self):
        return f"{self.name} - {self.department.name if self.department else 'N/A'}"


class Employee(models.Model):
    """A single employee profile."""

    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ]
    BLOOD_GROUP_CHOICES = [
        ('A+', 'A+'), ('A-', 'A-'),
        ('B+', 'B+'), ('B-', 'B-'),
        ('AB+', 'AB+'), ('AB-', 'AB-'),
        ('O+', 'O+'), ('O-', 'O-'),
    ]
    EMPLOYMENT_TYPE_CHOICES = [
        ('permanent', 'Permanent'),
        ('contractual', 'Contractual'),
        ('part_time', 'Part Time'),
        ('probation', 'Probation'),
        ('intern', 'Intern'),
    ]
    EMPLOYMENT_STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('resigned', 'Resigned'),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='employees')

    # ১. ব্যক্তিগত তথ্য
    employee_id = models.CharField(max_length=40, blank=True, db_index=True,
                                   help_text='Auto generated, e.g. BD-EMP-0001')
    photo = models.ImageField(upload_to='employee_photos/', blank=True, null=True)
    name_en = models.CharField(max_length=200, verbose_name='Name (English)')
    name_bn = models.CharField(max_length=200, blank=True, null=True, verbose_name='Name (Bangla)')
    father_name = models.CharField(max_length=200, blank=True, null=True)
    mother_name = models.CharField(max_length=200, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True)
    blood_group = models.CharField(max_length=10, choices=BLOOD_GROUP_CHOICES, blank=True, null=True)
    nid_number = models.CharField(max_length=40, blank=True, null=True)

    # খ. যোগাযোগের তথ্য
    mobile_number = models.CharField(max_length=25, blank=True, null=True)
    alt_mobile_number = models.CharField(max_length=25, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    present_address = models.TextField(blank=True, null=True)
    permanent_address = models.TextField(blank=True, null=True)
    emergency_contact_name = models.CharField(max_length=200, blank=True, null=True)
    emergency_contact_mobile = models.CharField(max_length=25, blank=True, null=True)

    # গ. চাকরিসংক্রান্ত তথ্য
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees'
    )
    designation = models.ForeignKey(
        Designation, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees'
    )
    joining_date = models.DateField(blank=True, null=True)
    employment_type = models.CharField(max_length=20, choices=EMPLOYMENT_TYPE_CHOICES,
                                       blank=True, null=True)
    reporting_manager = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subordinates'
    )
    work_location = models.CharField(max_length=200, blank=True, null=True)
    employment_status = models.CharField(max_length=20, choices=EMPLOYMENT_STATUS_CHOICES,
                                         default='active')

    # ঘ. অফিসিয়াল তথ্য
    official_email = models.EmailField(blank=True, null=True)
    official_mobile = models.CharField(max_length=25, blank=True, null=True)
    id_card_number = models.CharField(max_length=50, blank=True, null=True)
    id_card_issue_date = models.DateField(blank=True, null=True)
    id_card_expiry_date = models.DateField(blank=True, null=True)

    # BDapp login account (optional)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='employee_profile'
    )

    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['employee_id', 'id']
        indexes = [
            models.Index(fields=['school', 'employment_status'], name='emp_school_status_idx'),
            models.Index(fields=['school', 'department'], name='emp_school_dept_idx'),
        ]

    def __str__(self):
        return f"{self.employee_id} - {self.name_en}"

    @staticmethod
    def next_employee_id(school_id):
        """Return the next sequential employee id for a school (BD-EMP-0001)."""
        prefix = 'BD-EMP-'
        existing = Employee.objects.filter(
            school_id=school_id, employee_id__startswith=prefix
        ).values_list('employee_id', flat=True)
        max_num = 0
        for eid in existing:
            try:
                num = int(str(eid).replace(prefix, '').strip())
                if num > max_num:
                    max_num = num
            except (TypeError, ValueError):
                continue
        return f"{prefix}{max_num + 1:04d}"

    def save(self, *args, **kwargs):
        if not self.employee_id and self.school_id:
            self.employee_id = Employee.next_employee_id(self.school_id)
        if not self.id_card_number:
            self.id_card_number = self.employee_id
        super().save(*args, **kwargs)
