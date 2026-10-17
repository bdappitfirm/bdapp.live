from django.db import models
from django.contrib.auth import get_user_model
from schools.models import School
from .number_utils import bengali_to_english_number
from django.utils import timezone
import re
import hashlib

User = get_user_model()

class ClassRoom(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='classrooms')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.name} - {self.school.name}"

class Section(models.Model):
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='sections')
    name = models.CharField(max_length=100)

    class Meta:
        unique_together = ('classroom', 'name')

    def __str__(self):
        return f"{self.classroom.name} ({self.name})"

class Subject(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='subjects')
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, blank=True, null=True)
    classrooms = models.ManyToManyField(ClassRoom, related_name='subjects', blank=True)
    sections = models.ManyToManyField(Section, related_name='subjects', blank=True)

    def __str__(self):
        return f"{self.name} ({self.school.name})"

    def save(self, *args, **kwargs):
        if self.name:
            import unicodedata
            self.name = unicodedata.normalize('NFKC', str(self.name)).strip()
        super().save(*args, **kwargs)

class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='students')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    roll_number = models.CharField(max_length=50, blank=True, null=True)
    student_group = models.CharField(max_length=20, blank=True, null=True, choices=[
        ('science', 'Science'),
        ('arts', 'Arts'),
        ('commerce', 'Commerce'),
    ], db_column='group')
    blood_group = models.CharField(max_length=10, choices=[
        ('A+', 'A+'), ('A-', 'A-'), ('B+', 'B+'), ('B-', 'B-'),
        ('AB+', 'AB+'), ('AB-', 'AB-'), ('O+', 'O+'), ('O-', 'O-'),
    ], blank=True, null=True)
    gender = models.CharField(max_length=10, choices=[
        ('male', 'Male'), ('female', 'Female'), ('other', 'Other'),
    ], blank=True, null=True)
    student_custom_id = models.CharField(max_length=50, blank=True, null=True, unique=True)
    guardian_name = models.CharField(max_length=255, blank=True, null=True)
    guardian_name_en = models.CharField(max_length=255, blank=True, null=True, verbose_name="Guardian Name (English)")
    father_name = models.CharField(max_length=255, blank=True, null=True)
    father_name_en = models.CharField(max_length=255, blank=True, null=True, verbose_name="Father's Name (English)")
    mother_name = models.CharField(max_length=255, blank=True, null=True)
    mother_name_en = models.CharField(max_length=255, blank=True, null=True, verbose_name="Mother's Name (English)")
    birth_date = models.DateField(blank=True, null=True)
    admission_date = models.DateField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    address_en = models.TextField(blank=True, null=True, verbose_name="Address (English)")
    subjects_list = models.TextField(blank=True, null=True, help_text="List of subjects for ToT/Student List")
    remarks = models.TextField(blank=True, null=True, help_text="Additional comments or notes")
    voter_number = models.CharField(max_length=20, blank=True, null=True)
    optional_subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True, related_name='optional_for_students')
    guardian = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    father = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='father_of')
    mother = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='mother_of')

    # SSC Information
    ssc_board = models.CharField(max_length=255, blank=True, null=True, default="Board of Intermediate and Secondary Education, Cumilla", verbose_name="SSC Board")
    ssc_roll = models.CharField(max_length=50, blank=True, null=True, verbose_name="SSC Roll No.")
    ssc_registration = models.CharField(max_length=50, blank=True, null=True, verbose_name="SSC Registration No.")
    ssc_session = models.CharField(max_length=20, blank=True, null=True, verbose_name="SSC Session")
    ssc_gpa = models.CharField(max_length=10, blank=True, null=True, verbose_name="SSC GPA")

    def __str__(self):
        return f"{self.user.username} - {self.classroom.name if self.classroom else 'N/A'}"

    def generate_custom_id(self):
        if not self.gender or not self.classroom or not self.roll_number:
            return None
        
        gender_prefix = 'M' if self.gender == 'male' else 'F' if self.gender == 'female' else 'O'
        s_id = str(self.school.id)
        class_name = self.classroom.name

        class_match = re.search(r'\d+', class_name)
        class_num = class_match.group() if class_match else '00'
        
        clean_roll = re.sub(r'\D', '', str(self.roll_number)) or '0'

        section_code = '0'
        if self.student_group:
            if self.student_group == 'science': section_code = '1'
            elif self.student_group == 'arts': section_code = '2'
            elif self.student_group == 'commerce': section_code = '3'
        elif self.section:
            s_name = self.section.name.lower()
            if 'বিজ্ঞান' in s_name or 'science' in s_name: section_code = '1'
            elif 'মানবিক' in s_name or 'arts' in s_name: section_code = '2'
            elif 'ব্যবসায় শিক্ষা' in s_name or 'commerce' in s_name or 'ব্যবসা' in s_name: section_code = '3'

        sid_part = s_id.zfill(3)
        class_part = class_num.zfill(2)
        roll_part = clean_roll.zfill(4)
        unique_suffix = str(self.id or '0').zfill(5)

        return f"{gender_prefix}{sid_part}{class_part}{section_code}{roll_part}{unique_suffix}"

    def save(self, *args, **kwargs):
        if self.roll_number:
            self.roll_number = bengali_to_english_number(self.roll_number)

        names_changed = True
        if self.pk:
            try:
                old = StudentProfile.objects.only('father_name', 'mother_name', 'guardian_name').get(pk=self.pk)
                names_changed = (old.father_name != self.father_name or old.mother_name != self.mother_name or old.guardian_name != self.guardian_name)
            except StudentProfile.DoesNotExist: pass

        if self.school_id and names_changed and not getattr(self, '_skip_parent_sync', False):
            def get_or_create_parent_user(name, role_suffix, gender):
                if not name or not str(name).strip(): return None
                try:
                    name_clean = ''.join(c for c in str(name).strip() if not (0x200B <= ord(c) <= 0x200D or ord(c) == 0xFEFF))
                    phone = getattr(self.user, 'phone_number', None)
                    phone_clean = re.sub(r'\D', '', str(phone)) if phone else None

                    parent_user = None
                    if phone_clean and len(phone_clean) >= 10:
                        parent_user = User.objects.filter(models.Q(phone_number__endswith=phone_clean[-10:]) | models.Q(username__endswith=phone_clean[-10:])).filter(profile__school_id=self.school_id, profile__role='parent', username__icontains=role_suffix).first()

                    if not parent_user:
                        name_slug = re.sub(r'[^a-z0-9]', '', name_clean.lower().replace(' ', ''))[:30] or "p" + hashlib.md5(name_clean.encode()).hexdigest()[:8]
                        unique_username = f"p_{self.school_id}_{name_slug}_{role_suffix}"[:140]
                        final_username = unique_username
                        if User.objects.filter(username__iexact=final_username).exists():
                            final_username = f"{unique_username}_{hashlib.md5(str(timezone.now()).encode()).hexdigest()[:4]}"[:150]
                        parent_user = User(username=final_username, first_name=name_clean.split()[0][:150], last_name=' '.join(name_clean.split()[1:])[:150], phone_number=phone)
                        parent_user.set_unusable_password()
                        parent_user.save()

                    from users.models import Profile
                    Profile.objects.update_or_create(user=parent_user, defaults={'school_id': self.school_id, 'role': 'parent', 'gender': gender})
                    return parent_user
                except Exception as pe:
                    print("Parent user sync error:", pe)
                    return None

            if self.father_name: self.father = get_or_create_parent_user(self.father_name, 'father', 'male')
            if self.mother_name: self.mother = get_or_create_parent_user(self.mother_name, 'mother', 'female')

        is_new = not self.pk
        super().save(*args, **kwargs)

        if is_new or not self.student_custom_id:
            self.student_custom_id = self.generate_custom_id()
            StudentProfile.objects.filter(pk=self.id).update(student_custom_id=self.student_custom_id)

class TeacherAssignment(models.Model):
    teacher = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assignments')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='assignments', null=True, blank=True)
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='teacher_assignments')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='teacher_assignments')

    def __str__(self):
        return f"{self.teacher.username} - {self.subject.name if self.subject else 'Class Teacher'} ({self.classroom.name})"

class VirtualClass(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    teacher = models.ForeignKey(User, on_delete=models.CASCADE)
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE)
    section = models.ForeignKey(Section, on_delete=models.CASCADE, null=True, blank=True)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    meeting_id = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=False)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

class Building(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='buildings')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.name} - {self.school.name}"

class Room(models.Model):
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name='rooms')
    name = models.CharField(max_length=100)
    capacity = models.IntegerField(default=30)

    def __str__(self):
        return f"{self.name} ({self.building.name})"

class ExamSeatPlan(models.Model):
    examination = models.ForeignKey('results.Examination', on_delete=models.CASCADE, related_name='seat_plans')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='seat_plans')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='seat_plans')
    seat_number = models.CharField(max_length=20)
    gender_segregated = models.BooleanField(default=True)
    session = models.CharField(max_length=20, choices=[('morning', 'Morning'), ('afternoon', 'Afternoon')], default='morning')

    class Meta:
        unique_together = ('examination', 'student')
