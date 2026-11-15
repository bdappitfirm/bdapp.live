from django.db import models
from django.conf import settings
from schools.models import School
from academics.models import ClassRoom, Section, Subject, StudentProfile
from decimal import Decimal
import re
from .utils import _round_half_up, _class_group, get_subject_maxima

User = settings.AUTH_USER_MODEL


def normalize_db_exam_type(name, current_type=None):
    import re
    n = (name or '').lower().strip()
    t = (current_type or '').lower().strip()
    combined = f"{n} {t}".strip()

    if re.search(r'pre[-_\s]?test|প্রাক[-_\s]?নির্বাচনী', combined, re.I):
        return 'pre_test'
    if re.search(r'half[-_\s]?yearly|semi|mid|অর্ধ[-_\s]?বার্ষিক', combined, re.I):
        return 'half_yearly'
    if re.search(r'annual|final|বার্ষিক', combined, re.I):
        return 'annual'
    if re.search(r'model|মডেল', combined, re.I):
        return 'model'
    if re.search(r'first[-_\s]?term|প্রথম[-_\s]?সাময়িক', combined, re.I):
        return 'first_term'
    if re.search(r'terminal|টার্মিনাল', combined, re.I):
        return 'terminal'
    if re.search(r'test|নির্বাচনী|টেস্ট', combined, re.I):
        return 'test'

    if t in ['half_yearly', 'pre_test', 'annual', 'test', 'model', 'first_term', 'terminal']:
        return t
    return t or 'test'


class Examination(models.Model):
    """Exam/Test definition"""
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='examinations')
    name = models.CharField(max_length=200)
    exam_type = models.CharField(max_length=50, default='test')
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='examinations')
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='examinations')
    exam_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    total_marks = models.IntegerField(default=100)
    pass_marks = models.IntegerField(default=33)
    written_max = models.IntegerField(null=True, blank=True)
    mcq_max = models.IntegerField(null=True, blank=True)
    practical_max = models.IntegerField(null=True, blank=True)
    year = models.IntegerField(null=True, blank=True, db_index=True)
    
    class Meta:
        ordering = ['-exam_date', 'name']
        indexes = [
            models.Index(fields=['school', 'classroom'], name='res_exam_sch_cls_idx'),
            models.Index(fields=['exam_date'], name='res_exam_date_idx'),
        ]
    
    def __str__(self):
        return f"{self.name} - {self.classroom.name}"
    
    def save(self, *args, **kwargs):
        if self.name:
            norm_type = normalize_db_exam_type(self.name, self.exam_type)
            if norm_type:
                self.exam_type = norm_type
        if not self.year:
            y = None
            try:
                if self.exam_date:
                    y = self.exam_date.year
            except Exception:
                y = None
            if y is None:
                try:
                    import re
                    m = re.search(r'(19|20)\d{2}', self.name or '')
                    if m:
                        y = int(m.group(0))
                except Exception:
                    y = None
            if y is None:
                # Fallback to current year if still None
                from datetime import datetime
                y = datetime.now().year
            self.year = y
        super().save(*args, **kwargs)


class ExamSlot(models.Model):
    """Exam routine slot - defines date, time, and subject for an exam"""
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='exam_slots', null=True, blank=True)
    examination = models.ForeignKey(Examination, on_delete=models.CASCADE, related_name='slots', null=True, blank=True)
    classroom = models.ForeignKey(ClassRoom, on_delete=models.CASCADE, related_name='exam_slots', null=True, blank=True)
    section = models.ForeignKey(Section, on_delete=models.SET_NULL, null=True, blank=True, related_name='exam_slots')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='exam_slots')
    exam_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    room = models.CharField(max_length=100, blank=True, null=True)
    
    class Meta:
        ordering = ['exam_date', 'start_time', 'subject']
    
    def __str__(self):
        return f"{self.subject.name} - {self.exam_date} {self.start_time}"


class Result(models.Model):
    """Individual student result for a subject in an exam"""
    GRADE_CHOICES = [
        ('A+', 'A+ (80-100)'),
        ('A', 'A (70-79)'),
        ('A-', 'A- (60-69)'),
        ('B', 'B (50-59)'),
        ('C', 'C (40-49)'),
        ('D', 'D (33-39)'),
        ('F', 'F (0-32)'),
    ]
    
    examination = models.ForeignKey(Examination, on_delete=models.CASCADE, related_name='results')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='results')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='results')
    
    # Marks breakdown
    written_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, default=None)
    mcq_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, default=None)
    practical_marks = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, default=None)
    total_obtained = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Auto-calculated
    grade = models.CharField(max_length=5, blank=True)
    gpa = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    is_passed = models.BooleanField(default=False)
    
    # Optional
    remarks = models.TextField(blank=True)
    
    class Meta:
        unique_together = ('examination', 'student', 'subject')
        ordering = ['examination', 'student', 'subject']
        indexes = [
            models.Index(fields=['examination', 'student'], name='res_item_exam_stu_idx'),
            models.Index(fields=['student'], name='res_item_student_idx'),
        ]
    
    def save(self, *args, **kwargs):
        is_empty = (
            (self.written_marks is None or str(self.written_marks).strip() == '') and
            (self.mcq_marks is None or str(self.mcq_marks).strip() == '') and
            (self.practical_marks is None or str(self.practical_marks).strip() == '')
        )

        if is_empty:
            self.total_obtained = Decimal('0')
            self.grade = 'AB'
            self.gpa = Decimal('0.00')
            self.is_passed = False
            super().save(*args, **kwargs)
            return

        def to_dec(val):
            if val is None or str(val).strip() == '':
                return Decimal('0')
            try:
                return Decimal(str(val))
            except Exception:
                return Decimal('0')

        wm = to_dec(self.written_marks)
        mm = to_dec(self.mcq_marks)
        pm = to_dec(self.practical_marks)

        self.total_obtained = wm + mm + pm
        
        group = _class_group(getattr(self.examination.classroom, "name", None))

        # Fetch school-specific pass percentage if configured, default to 33.00
        pass_pct = 33.00
        try:
            if self.examination and self.examination.school:
                policy = getattr(self.examination.school, 'grading_policy', None)
                if policy:
                    pass_pct = float(policy.pass_percentage)
        except Exception:
            pass_pct = 33.00

        if group == 'primary':
            wm_max = 50 if any(w in (self.subject.name or '').lower() for w in ['অংকন', 'drawing', 'চিত্রাংকন']) else 100
            pass_threshold = Decimal(str(round(float(wm_max) * (pass_pct / 100.0))))
            self.is_passed = wm >= pass_threshold
            percentage = (float(wm) / float(wm_max)) * 100 if wm_max > 0 else 0

            if percentage >= 80: self.grade = 'A+'; self.gpa = Decimal('5.00')
            elif percentage >= 70: self.grade = 'A'; self.gpa = Decimal('4.00')
            elif percentage >= 60: self.grade = 'A-'; self.gpa = Decimal('3.50')
            elif percentage >= 50: self.grade = 'B'; self.gpa = Decimal('3.00')
            elif percentage >= 40: self.grade = 'C'; self.gpa = Decimal('2.00')
            elif percentage >= pass_pct: self.grade = 'D'; self.gpa = Decimal('1.00')
            else: self.grade = 'F'; self.gpa = Decimal('0.00')

            if not self.is_passed:
                self.grade = 'F'
                self.gpa = Decimal('0.00')

            self.total_obtained = wm + mm + pm
            super().save(*args, **kwargs)
            return

        # Resolve student_group for combined slash subject names (9-10) to pick correct maxima
        _sg = None
        try:
            if group == 'nine_ten':
                _sg = (getattr(getattr(self, 'student', None), 'student_group', None) or '').lower() or None
        except Exception:
            _sg = None
        maxima = get_subject_maxima(group, getattr(self.subject, "name", None), _sg) or {}
        
        if maxima:
            wm_max = int(maxima.get("written", 0))
            mm_max = int(maxima.get("mcq", 0))
            pm_max = int(maxima.get("practical", 0))
        else:
            wm_max = 0
            mm_max = 0
            pm_max = 0

        denom = Decimal(wm_max + mm_max + pm_max) if (wm_max or mm_max or pm_max) else Decimal(self.examination.total_marks)
        percentage = (self.total_obtained / denom) * 100 if denom > 0 else 0

        # Pass/Fail logic: if all marks are None, it's NOT a fail, it's just no record/absent.
        # But if we have a record, we usually want it to be a fail if it doesn't meet pass marks.
        # UNLESS the user explicitly wants "Empty".

        # Check if actually absent (all fields None)
        is_empty = self.written_marks is None and self.mcq_marks is None and self.practical_marks is None

        # First, always calculate grade and GPA based on percentage
        if percentage >= 80:
            self.grade = 'A+'
            self.gpa = 5.00
        elif percentage >= 70:
            self.grade = 'A'
            self.gpa = 4.00
        elif percentage >= 60:
            self.grade = 'A-'
            self.gpa = 3.50
        elif percentage >= 50:
            self.grade = 'B'
            self.gpa = 3.00
        elif percentage >= 40:
            self.grade = 'C'
            self.gpa = 2.00
        elif percentage >= pass_pct:
            self.grade = 'D'
            self.gpa = 1.00
        else:
            self.grade = 'F'
            self.gpa = 0.00
            
        # Pass/Fail calculation
        is_nine_ten = group == 'nine_ten'

        # Accurate Board Pass Rule: total_obtained >= round(denom * pass_pct / 100.0)
        pass_threshold = Decimal(str(round(float(denom) * (pass_pct / 100.0))))
        self.is_passed = self.total_obtained >= pass_threshold
        
        # STRICT RULE for Class 9-10: Separate pass for each component
        # (Except for 2-paper combined subjects like Bangla/English 1st & 2nd, where board evaluates combined pass)
        if is_nine_ten and self.is_passed:
            sname = (self.subject.name if self.subject else '').lower()
            is_2paper = bool(re.search(r'bangla|বাংলা|english|ইংরেজি|ইংরেজী', sname)) and bool(re.search(r'১ম|1st|first|২য়|২য়|2nd|second', sname))
            if not is_2paper:
                comp_pct = pass_pct / 100.0
                if wm_max > 0 and float(wm) < round(wm_max * comp_pct):
                    self.is_passed = False
                if mm_max > 0 and float(mm) < round(mm_max * comp_pct):
                    self.is_passed = False
                if pm_max > 0 and float(pm) < round(pm_max * comp_pct):
                    self.is_passed = False

        # Override grade and GPA if failed
        if not self.is_passed:
            self.grade = 'F'
            self.gpa = Decimal('0.00')
        else:
            # Recalculate grade if it was wrongly set to F before due to total %
            if self.grade == 'F':
                if percentage >= 40: self.grade = 'C'
                elif percentage >= pass_pct: self.grade = 'D'
        
        # If all marks are None, we shouldn't really have a grade/GPA,
        # but the model fields are not nullable for grade/gpa currently.
        # We'll let it stay as F/0.00 but the ResultCard will show it as Absent.

        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.student.user.get_full_name()} - {self.subject.name} - {self.grade}"


class StudentOverallResult(models.Model):
    """Overall result summary for a student in an exam"""
    examination = models.ForeignKey(Examination, on_delete=models.CASCADE, related_name='overall_results')
    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='overall_results')

    # New field to support year-based reporting
    academic_year = models.IntegerField(null=True, blank=True, db_index=True)

    total_marks_obtained = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    total_marks_possible = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    cgpa = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    grade = models.CharField(max_length=5, blank=True)
    
    rank = models.IntegerField(null=True, blank=True)
    is_passed = models.BooleanField(default=False)
    failed_subjects_count = models.IntegerField(default=0)
    failed_subjects_list = models.JSONField(default=list, blank=True)

    class Meta:
        unique_together = ('examination', 'student')
        ordering = ['-cgpa', 'student']
        indexes = [
            models.Index(fields=['examination', '-cgpa'], name='res_ovr_exam_cgpa_idx'),
        ]
    
    def __str__(self):
        return f"{self.student.user.get_full_name()} - CGPA: {self.cgpa}"
