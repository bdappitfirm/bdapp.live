from django.db import models
from django.conf import settings
from schools.models import School
from academics.models import StudentProfile

class AttendanceRecord(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='attendance_records')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField()
    present = models.BooleanField(default=True)
    note = models.TextField(blank=True, null=True)
    taken_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='attendance_taken'
    )
    taken_by_name = models.CharField(max_length=150, blank=True, default='')
    device_id = models.CharField(max_length=200, blank=True, null=True, help_text="Unique ID of the scanning device")
    scan_time = models.DateTimeField(null=True, blank=True, help_text="Exact time of the QR scan")
    session = models.CharField(max_length=50, blank=True, null=True, help_text="Academic year/session")
    operator_log = models.JSONField(default=dict, blank=True, help_text="Audit log of operators who modified this record")
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        unique_together = ('student', 'date')
        ordering = ['-date']
        indexes = [
            models.Index(fields=['school', 'date'], name='att_rec_sch_date_idx'),
            models.Index(fields=['school'], name='att_rec_school_idx'),
            models.Index(fields=['date'], name='att_rec_date_idx'),
            models.Index(fields=['student'], name='att_rec_student_idx'),
            models.Index(fields=['taken_by_user'], name='att_rec_taken_by_idx'),
        ]

    def __str__(self):
        return f"{self.student.user.username} - {self.date}"
