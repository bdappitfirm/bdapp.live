from django.contrib.auth.models import AbstractUser
from django.db import models
from schools.models import School


class User(AbstractUser):
    photo = models.ImageField(upload_to='user_photos/', null=True, blank=True)
    phone_number = models.CharField(max_length=20, null=True, blank=True, help_text='Phone number with country code (e.g., +8801712345678)')
    educational_qualification = models.CharField(max_length=200, blank=True, null=True, help_text='Educational qualification (e.g., B.A., M.A., B.Ed.)')
    
    def __str__(self):
        return self.username

class Profile(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('teacher', 'Teacher'),
        ('student', 'Student'),
        ('parent', 'Parent'),
        ('committee', 'Committee'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    school = models.ForeignKey(School, on_delete=models.SET_NULL, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    gender = models.CharField(max_length=10, choices=[
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ], blank=True, null=True)
    designation = models.CharField(max_length=100, blank=True, null=True, help_text='Designation/Role for committee members')
    blood_group = models.CharField(max_length=10, choices=[
        ('A+', 'A+'),
        ('A-', 'A-'),
        ('B+', 'B+'),
        ('B-', 'B-'),
        ('AB+', 'AB+'),
        ('AB-', 'AB-'),
        ('O+', 'O+'),
        ('O-', 'O-'),
    ], blank=True, null=True, help_text='Blood group of the user')
    occupation = models.CharField(max_length=120, blank=True, null=True, help_text='Occupation of the user (parent/guardian)')
    income = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, help_text='Monthly income (numeric)')
    
    # Teacher-specific fields
    index_number = models.CharField(max_length=100, blank=True, null=True, help_text='Index number for teacher ID')
    joining_date = models.DateField(blank=True, null=True, help_text='Teacher joining date')
    assigned_subject = models.ForeignKey('academics.Subject', on_delete=models.SET_NULL, null=True, blank=True, related_name='teacher_profiles', help_text='Subject assigned to teacher')
    
    # Class teacher info (mainly for teachers)
    class_teacher_classroom = models.ForeignKey('academics.ClassRoom', on_delete=models.SET_NULL, null=True, blank=True, related_name='class_teacher_profiles')
    class_teacher_section = models.ForeignKey('academics.Section', on_delete=models.SET_NULL, null=True, blank=True, related_name='class_teacher_profiles')

    def __str__(self):
        return f"{self.user.username} - {self.role}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Sync gender to StudentProfile if this is a student
        if self.role == 'student' and self.gender:
            try:
                from academics.models import StudentProfile
                student_profile = StudentProfile.objects.get(user=self.user)
                if student_profile.gender != self.gender:
                    student_profile.gender = self.gender
                    student_profile.save(update_fields=['gender'])
            except Exception:
                pass

    class Meta:
        indexes = [
            models.Index(fields=['school', 'role'], name='users_profile_school_role_idx'),
            models.Index(fields=['school'], name='users_profile_school_idx'),
        ]

class AdminProfile(Profile):
    class Meta:
        proxy = True
        verbose_name = 'Admin'
        verbose_name_plural = 'Admins'

class ParentProfile(Profile):
    class Meta:
        proxy = True
        verbose_name = 'Parent'
        verbose_name_plural = 'Parents'

class CommitteeProfile(Profile):
    class Meta:
        proxy = True
        verbose_name = 'Committee'
        verbose_name_plural = 'Committees'

class Task(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]
    
    title = models.CharField(max_length=200, help_text='Task title')
    description = models.TextField(blank=True, null=True, help_text='Task description')
    assigned_to = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='assigned_tasks',
        help_text='Committee member assigned to this task'
    )
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='tasks')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    due_date = models.DateField(null=True, blank=True, help_text='Task due date')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_tasks',
        help_text='User who created this task'
    )
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['assigned_to', 'school'], name='users_task_assigned_school_idx'),
            models.Index(fields=['school', 'status'], name='users_task_school_status_idx'),
            models.Index(fields=['due_date'], name='users_task_due_date_idx'),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.assigned_to.username}"

class ActivityLog(models.Model):
    ACTION_CHOICES = [
        ('profile_create', 'Profile Creation'),
        ('login', 'User Login'),
        ('data_input', 'Data Input'),
        ('result_input', 'Result Input'),
    ]
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='activities')
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='activities')
    action_type = models.CharField(max_length=50, choices=ACTION_CHOICES)
    details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00) # 3 TK per profile

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['school', 'timestamp'], name='activity_school_ts_idx'),
            models.Index(fields=['action_type'], name='activity_type_idx'),
        ]

    def __str__(self):
        return f"{self.user.username if self.user else 'Unknown'} - {self.action_type} - {self.timestamp}"

class AssistantLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assistant_logs')
    school = models.ForeignKey(School, on_delete=models.SET_NULL, null=True, blank=True, related_name='assistant_logs')
    query_text = models.TextField()
    intent = models.CharField(max_length=100, blank=True, null=True)
    params = models.JSONField(default=dict)
    result_summary = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['school', 'intent'], name='users_asstlog_school_int_idx'),
            models.Index(fields=['created_at'], name='users_asstlog_created_at_idx'),
        ]
    def __str__(self):
        return f"{self.intent or ''} - {self.query_text[:30]}"

class AssistantMemory(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='assistant_memory')
    key = models.CharField(max_length=200)
    data = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        unique_together = ('school', 'key')
        indexes = [
            models.Index(fields=['school', 'key'], name='users_asstmem_school_key_idx'),
        ]
    def __str__(self):
        return f"{self.school_id} - {self.key}"

class AssistantKnowledge(models.Model):
    """Stores unstructured facts or context for the AI to learn from."""
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='knowledge_base')
    category = models.CharField(max_length=100, default='general')
    fact = models.TextField(help_text="The information the AI has learned")
    source = models.CharField(max_length=200, blank=True, null=True, help_text="Where this info came from (e.g. user_interaction, document)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_verified = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.category}: {self.fact[:50]}..."

class AIChatSession(models.Model):
    """Stores a chat session for multi-turn conversation context."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ai_sessions', null=True, blank=True)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='ai_sessions')
    title = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username if self.user else 'Anonymous'} - {self.title or self.created_at}"

class AIChatMessage(models.Model):
    """Stores individual messages within a session."""
    session = models.ForeignKey(AIChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=20, choices=[('user', 'User'), ('assistant', 'AI')], default='user')
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.role}: {self.content[:30]}"

class SupportCall(models.Model):
    STATUS_CHOICES = [
        ('waiting', 'Waiting'),
        ('accepted', 'Accepted'),
        ('ended', 'Ended'),
        ('cancelled', 'Cancelled'),
        ('rejected', 'Rejected'),
    ]

    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='support_calls')
    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='support_calls_requested')
    accepted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='support_calls_accepted')
    room_name = models.CharField(max_length=200, unique=True)
    requester_label = models.CharField(max_length=200, blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting')
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    last_client_ping_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['school', 'status'], name='users_supcall_sch_stat_idx'),
            models.Index(fields=['status', 'created_at'], name='users_supcall_stat_cre_idx'),
            models.Index(fields=['requester', 'status'], name='users_supcall_req_stat_idx'),
        ]
