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
    ], db_column='group')  # Keep using existing 'group' column
    blood_group = models.CharField(max_length=10, choices=[
        ('A+', 'A+'), ('A-', 'A-'), ('B+', 'B+'), ('B-', 'B-'),
        ('AB+', 'AB+'), ('AB-', 'AB-'), ('O+', 'O+'), ('O-', 'O-'),
    ], blank=True, null=True)
    gender = models.CharField(max_length=10, choices=[
        ('male', 'Male'), ('female', 'Female'), ('other', 'Other'),
    ], blank=True, null=True)
    student_custom_id = models.CharField(max_length=50, blank=True, null=True, unique=True)
    guardian_name = models.CharField(max_length=255, blank=True, null=True)
    father_name = models.CharField(max_length=255, blank=True, null=True)
    mother_name = models.CharField(max_length=255, blank=True, null=True)
    birth_date = models.DateField(blank=True, null=True)
    admission_date = models.DateField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    subjects_list = models.TextField(blank=True, null=True, help_text="List of subjects for ToT/Student List")
    remarks = models.TextField(blank=True, null=True, help_text="Additional comments or notes")
    voter_number = models.CharField(max_length=20, blank=True, null=True)
    optional_subject = models.ForeignKey(Subject, on_delete=models.SET_NULL, null=True, blank=True, related_name='optional_for_students')
    guardian = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    father = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='father_of')
    mother = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='mother_of')

    def __str__(self):
        return f"{self.user.username} - {self.classroom.name if self.classroom else 'N/A'}"

    def generate_custom_id(self):
        if not self.gender or not self.classroom or not self.roll_number:
            return None
        
        gender_prefix = 'M' if self.gender == 'male' else 'F' if self.gender == 'female' else 'O'
        s_id = str(self.school.id)
        class_name = self.classroom.name

        class_match = re.search(r'\d+', class_name)
        if class_match:
            class_num = class_match.group()
        else:
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
            if not class_num: return None
        
        clean_roll = re.sub(r'\D', '', str(self.roll_number))
        if not clean_roll: clean_roll = '0'

        section_code = '0'
        if self.student_group:
            if self.student_group == 'science': section_code = '1'
            elif self.student_group == 'arts': section_code = '2'
            elif self.student_group == 'commerce': section_code = '3'
        elif self.section:
            section_name = self.section.name.lower()
            if 'বিজ্ঞান' in section_name or 'science' in section_name: section_code = '1'
            elif 'মানবিক' in section_name or 'arts' in section_name: section_code = '2'
            elif 'ব্যবসায় শিক্ষা' in section_name or 'commerce' in section_name or 'ব্যবসা' in section_name: section_code = '3'

        # Format: G-SID(3)-CLASS(2)-SEC-ROLL(4)
        return f"{gender_prefix}{s_id.zfill(3)}{class_num.zfill(2)}{section_code}{clean_roll.zfill(4)}"

    def save(self, *args, **kwargs):
        if self.roll_number:
            self.roll_number = bengali_to_english_number(self.roll_number)

        # Optimization: Only run heavy logic if necessary
        names_changed = True
        id_needs_update = False

        if self.pk:
            try:
                old = StudentProfile.objects.only('father_name', 'mother_name', 'guardian_name', 'gender', 'classroom_id', 'student_group', 'section_id', 'roll_number', 'student_custom_id').get(pk=self.pk)
                names_changed = (old.father_name != self.father_name or old.mother_name != self.mother_name or old.guardian_name != self.guardian_name)
                id_needs_update = (
                    old.gender != self.gender or old.classroom_id != self.classroom_id or
                    old.student_group != self.student_group or old.section_id != self.section_id or
                    old.roll_number != self.roll_number or not old.student_custom_id or len(old.student_custom_id) < 11
                )
            except StudentProfile.DoesNotExist: pass
        else:
            id_needs_update = True

        if id_needs_update:
            self.student_custom_id = self.generate_custom_id()

        if self.school_id and names_changed:
            from users.models import Profile

            def get_or_create_parent_user(name, role_suffix, gender):
                if not name or not str(name).strip(): return None
                name_clean = str(name).strip()
                name_clean = ''.join(c for c in name_clean if not (0x200B <= ord(c) <= 0x200D or ord(c) == 0xFEFF))
                phone = getattr(self.user, 'phone_number', None)
                phone_clean = re.sub(r'\D', '', str(phone)) if phone else None
                parent_user = None

                if phone_clean and len(phone_clean) >= 10:
                    parent_user = User.objects.filter(models.Q(phone_number__endswith=phone_clean[-10:]) | models.Q(username__endswith=phone_clean[-10:])).filter(profile__school_id=self.school_id, profile__role='parent', username__icontains=role_suffix).first()

                if not parent_user:
                    name_slug = re.sub(r'[^a-z0-9]', '', name_clean.lower().replace(' ', ''))
                    if name_slug:
                        unique_username = f"p_{self.school_id}_{name_slug}_{role_suffix}"
                        parent_user = User.objects.filter(username__iexact=unique_username).first()

                parts = name_clean.split()
                first = parts[0] if parts else 'Parent'
                last = ' '.join(parts[1:]) if len(parts) > 1 else ''

                if not parent_user:
                    name_slug = re.sub(r'[^a-z0-9]', '', name_clean.lower().replace(' ', '')) or "p" + hashlib.md5(name_clean.encode()).hexdigest()[:10]
                    unique_username = f"p_{self.school_id}_{name_slug}_{role_suffix}"
                    final_username = unique_username
                    if User.objects.filter(username__iexact=final_username).exists():
                         final_username = f"{unique_username}_{hashlib.md5(str(timezone.now()).encode()).hexdigest()[:4]}"

                    parent_user = User(username=final_username, first_name=first, last_name=last, phone_number=phone)
                    parent_user.set_unusable_password()
                    parent_user.save()
                else:
                    up_fields = []
                    if parent_user.first_name != first: parent_user.first_name = first; up_fields.append('first_name')
                    if parent_user.last_name != last: parent_user.last_name = last; up_fields.append('last_name')
                    if phone and parent_user.phone_number != phone: parent_user.phone_number = phone; up_fields.append('phone_number')
                    if up_fields: parent_user.save(update_fields=up_fields)

                Profile.objects.update_or_create(user=parent_user, defaults={'school_id': self.school_id, 'role': 'parent', 'gender': gender})
                return parent_user

            if self.father_name: self.father = get_or_create_parent_user(self.father_name, 'father', 'male')
            if self.mother_name: self.mother = get_or_create_parent_user(self.mother_name, 'mother', 'female')

            if self.guardian_name:
                g_name = self.guardian_name.strip()
                if self.father and g_name == self.father_name.strip(): self.guardian = self.father
                elif self.mother and g_name == self.mother_name.strip(): self.guardian = self.mother
                else: self.guardian = get_or_create_parent_user(self.guardian_name, 'guardian', None)
            elif self.father: self.guardian = self.father
            elif self.mother: self.guardian = self.mother

        super().save(*args, **kwargs)

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
