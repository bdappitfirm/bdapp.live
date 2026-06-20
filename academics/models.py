from django.db import models
from django.conf import settings
from schools.models import School
from .number_utils import bengali_to_english_number

# Use the project's custom user model
User = settings.AUTH_USER_MODEL

class ClassRoom(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='classrooms')
    name = models.CharField(max_length=100)  # e.g., Grade 1
    description = models.TextField(blank=True, null=True)
    class Meta:
        unique_together = ('school', 'name')
        ordering = ['name']
        indexes = [
            models.Index(fields=['school', 'name'], name='acad_cls_school_name_idx'),
            models.Index(fields=['school'], name='acad_cls_school_idx'),
        ]

    def __str__(self):
        return f"{self.school.name} - {self.name}"

class Section(models.Model):
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='sections')
    name = models.CharField(max_length=50)  # e.g., A, B

    class Meta:
        unique_together = ('classroom', 'name')

    def __str__(self):
        return f"{self.classroom.name} - {self.name}"

class Subject(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='subjects')
    classrooms = models.ManyToManyField(ClassRoom, related_name='subjects', blank=True)
    sections = models.ManyToManyField(Section, related_name='subjects', blank=True)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        unique_together = ('school', 'name')
        indexes = [
            models.Index(fields=['school', 'name'], name='acad_subj_school_name_idx'),
            models.Index(fields=['school'], name='acad_subj_school_idx'),
        ]

    def __str__(self):
        return self.name

class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='students')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    roll_number = models.CharField(max_length=50, blank=True, null=True)
    group = models.CharField(max_length=20, blank=True, null=True, choices=[
        ('science', 'Science'),
        ('arts', 'Arts'),
        ('commerce', 'Commerce'),
    ])
    blood_group = models.CharField(max_length=10, choices=[
        ('A+', 'A+'),
        ('A-', 'A-'),
        ('B+', 'B+'),
        ('B-', 'B-'),
        ('AB+', 'AB+'),
        ('AB-', 'AB-'),
        ('O+', 'O+'),
        ('O-', 'O-'),
    ], blank=True, null=True)
    gender = models.CharField(max_length=10, choices=[
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ], blank=True, null=True)
    student_custom_id = models.CharField(max_length=50, blank=True, null=True, unique=True)
    # Parent linkage
    guardian_name = models.CharField(max_length=255, blank=True, null=True)
    guardian = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='children')

    def generate_custom_id(self):
        """Generate custom ID like M6213 or F1022"""
        if not self.gender or not self.classroom or not self.roll_number:
            return None
        
        # Gender prefix
        gender_prefix = 'M' if self.gender == 'male' else 'F' if self.gender == 'female' else 'O'
        
        # Class number: extract numeric part from classroom name (e.g., "Class 6" → 6, "Six" → 6, "Grade 10" → 10)
        class_name = self.classroom.name
        import re
        class_match = re.search(r'\d+', class_name)
        if class_match:
            class_num = class_match.group()
        else:
            # Try to map word numbers (One, Two... Ten) to digits
            word_to_num = {
                'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
                'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
                'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14', 'fifteen': '15',
                'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 'nineteen': '19', 'twenty': '20'
            }
            lower_class_name = class_name.lower()
            class_num = None
            for word, num in word_to_num.items():
                if word in lower_class_name:
                    class_num = num
                    break
            if not class_num:
                return None
        
        # Section/group code
        section_code = '0'
        if self.group:
            if self.group == 'science':
                section_code = '1'
            elif self.group == 'arts':
                section_code = '2'
            elif self.group == 'commerce':
                section_code = '3'
        elif self.section:
            # If no group, try to extract from section name
            section_name = self.section.name.lower()
            if 'বিজ্ঞান' in section_name or 'science' in section_name:
                section_code = '1'
            elif 'মানবিক' in section_name or 'arts' in section_name:
                section_code = '2'
            elif 'ব্যবসা' in section_name or 'commerce' in section_name:
                section_code = '3'
            else:
                # Try to map section letters (A=1, B=2, etc.)
                import string
                section_char = section_name.strip()[0] if section_name.strip() else 'a'
                if section_char.lower() in string.ascii_lowercase:
                    section_code = str(string.ascii_lowercase.index(section_char.lower()) + 1)
                else:
                    # Try numeric
                    section_match = re.search(r'\d+', section_name)
                    if section_match:
                        section_code = section_match.group()
        
        # Roll number (ensure it's at least 2 digits, pad with leading zero if needed)
        roll_str = str(self.roll_number).zfill(2)
        
        # Combine all parts
        return f"{gender_prefix}{class_num}{section_code}{roll_str}"

    def save(self, *args, **kwargs):
        # Convert roll number to English digits
        if self.roll_number:
            self.roll_number = bengali_to_english_number(self.roll_number)
        # Check if we need to regenerate the custom ID
        if self.pk:
            # Get the existing data from the database
            try:
                old_student = StudentProfile.objects.get(pk=self.pk)
                # Compare relevant fields
                fields_changed = (
                    old_student.gender != self.gender or
                    old_student.classroom != self.classroom or
                    old_student.group != self.group or
                    old_student.section != self.section or
                    old_student.roll_number != self.roll_number
                )
                if fields_changed:
                    # Regenerate custom ID
                    self.student_custom_id = self.generate_custom_id()
            except StudentProfile.DoesNotExist:
                # New student, generate ID
                self.student_custom_id = self.generate_custom_id()
        else:
            # New student, generate ID
            self.student_custom_id = self.generate_custom_id()
        super().save(*args, **kwargs)

    def __str__(self):
        # user may be AbstractUser
        try:
            name = self.user.get_full_name() or self.user.username
        except:
            name = str(self.user)
        return f"{name} ({self.school.name})"

    class Meta:
        indexes = [
            models.Index(fields=['school'], name='acad_stu_school_idx'),
            models.Index(fields=['classroom'], name='acad_stu_classroom_idx'),
            models.Index(fields=['section'], name='acad_stu_section_idx'),
            models.Index(fields=['school', 'classroom'], name='acad_stu_sch_cls_idx'),
        ]
        ordering = ['roll_number']

class TeacherAssignment(models.Model):
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assignments')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='assignments')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='assignments')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='assignments')

    class Meta:
        unique_together = ('teacher', 'subject', 'classroom', 'section')

    def __str__(self):
        return f"{self.teacher} - {self.subject.name} - {self.classroom.name}"

class StudentYearRecord(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='student_year_records')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='year_records')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.SET_NULL, null=True, blank=True, related_name='year_records')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='year_records')
    roll_number = models.CharField(max_length=50, blank=True, null=True)
    academic_year = models.CharField(max_length=9)  # e.g., "2025" or "2024-2025"
    status = models.CharField(max_length=20, choices=[
        ('promoted', 'Promoted'),
        ('retained', 'Retained'),
        ('not_passed', 'Not Passed'),
    ], default='promoted')
    examination_id = models.IntegerField(blank=True, null=True)
    result_cgpa = models.FloatField(blank=True, null=True)
    result_grade = models.CharField(max_length=5, blank=True, null=True)
    percentage = models.FloatField(blank=True, null=True)
    rank = models.IntegerField(blank=True, null=True)
    promoted_to_classroom = models.ForeignKey(ClassRoom, on_delete=models.SET_NULL, null=True, blank=True, related_name='promoted_year_records')
    promoted_on = models.DateTimeField(blank=True, null=True)
    meta = models.JSONField(blank=True, null=True)

    class Meta:
        unique_together = ('student', 'academic_year')
        indexes = [
            models.Index(fields=['school', 'academic_year'], name='acad_yr_sch_yr_idx'),
            models.Index(fields=['student', 'academic_year'], name='acad_yr_stu_yr_idx'),
        ]
        ordering = ['-academic_year', 'student_id']

    def __str__(self):
        try:
            nm = self.student.user.get_full_name() or self.student.user.username
        except:
            nm = str(self.student_id)
        return f"{nm} - {self.academic_year} ({self.status})"

class VirtualClass(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='virtual_classes')
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='virtual_classes')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='virtual_classes')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='virtual_classes')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='virtual_classes')
    meeting_id = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.subject.name} - {self.teacher}"


class Building(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='buildings')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('school', 'name')
        ordering = ['name']
        indexes = [
            models.Index(fields=['school', 'name'], name='acad_building_school_name_idx'),
        ]

    def __str__(self):
        return f"{self.school.name} - {self.name}"


class Room(models.Model):
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name='rooms')
    name = models.CharField(max_length=100)  # e.g., "Room 101", "Room A-1"
    capacity = models.IntegerField(default=40)

    class Meta:
        unique_together = ('building', 'name')
        ordering = ['building', 'name']
        indexes = [
            models.Index(fields=['building', 'name'], name='acad_room_building_name_idx'),
        ]

    def __str__(self):
        return f"{self.building.name} - {self.name}"


class ExamSeatPlan(models.Model):
    exam_slot = models.ForeignKey('results.ExamSlot', on_delete=models.CASCADE, related_name='seat_plans', null=True, blank=True)
    examination = models.ForeignKey('results.Examination', on_delete=models.CASCADE, related_name='seat_plans', null=True, blank=True)
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='seat_plans')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='seat_plans')
    seat_number = models.CharField(max_length=50)
    gender_segregated = models.BooleanField(default=True)
    SESSION_CHOICES = [
        ('morning', 'Morning'),
        ('afternoon', 'Afternoon'),
    ]
    session = models.CharField(max_length=10, choices=SESSION_CHOICES, default='morning')

    class Meta:
        unique_together = ('exam_slot', 'student')
        ordering = ['room', 'seat_number']
        indexes = [
            models.Index(fields=['exam_slot', 'room'], name='acad_seatplan_slot_room_idx'),
            models.Index(fields=['examination', 'room'], name='acad_seatplan_exam_room_idx'),
        ]

    def __str__(self):
        return f"{self.student} - {self.room} - {self.seat_number}"
