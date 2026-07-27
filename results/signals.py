from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Result, StudentOverallResult, Examination


@receiver(post_save, sender=Result)
def calculate_overall_result_on_save(sender, instance, created, **kwargs):
    """
    Automatically calculate overall result when a Result is saved.
    This ensures GPA is always up-to-date when results are added or updated.
    """
    calculate_student_overall_result(instance.examination, instance.student)


@receiver(post_delete, sender=Result)
def calculate_overall_result_on_delete(sender, instance, **kwargs):
    """
    Recalculate overall result when a Result is deleted.
    """
    calculate_student_overall_result(instance.examination, instance.student)


def calculate_student_overall_result(examination, student):
    """
    Calculate and save overall result for a student in an examination.
    This combines all subject results to calculate CGPA and overall grade.
    """
    # Get all results for this student in this examination
    all_results = Result.objects.filter(
        examination=examination,
        student=student
    )
    
    if not all_results.exists():
        # If no results exist, delete the overall result if it exists
        StudentOverallResult.objects.filter(
            examination=examination,
            student=student
        ).delete()
        return

    # Filter out subjects that should not be included in GPA calculation
    # (Continuous Assessment / Co-curricular subjects)
    EXCLUDED_SUBJECTS = [
        'শারীরিক শিক্ষা ও স্বাস্থ্য', 'শারীরিক শিক্ষা', 'physical education',
        'ক্যারিয়ার শিক্ষা', 'career education', 'ক্যারিয়ার',
        'word collection achievement test', 'wcat',
        'বই পড়া', 'বই পড়া'
    ]

    main_results = []
    optional_result = None
    optional_subject_id = student.optional_subject_id
    optional_subject_name = student.optional_subject.name.lower() if student.optional_subject else ""

    for r in all_results:
        subject_name = r.subject.name.lower().strip()
        is_excluded = any(ex in subject_name for ex in EXCLUDED_SUBJECTS)
        if is_excluded:
            continue

        # More robust optional subject matching
        is_optional = False
        if optional_subject_id and r.subject_id == optional_subject_id:
            is_optional = True
        elif optional_subject_name and optional_subject_name in subject_name:
            is_optional = True
        elif '(optional)' in subject_name or '(ঐচ্ছিক)' in subject_name:
            is_optional = True

        if is_optional:
            optional_result = r
        else:
            main_results.append(r)

    # If no main subjects found, use all results (fallback)
    results_to_calculate = main_results if main_results else list(all_results)
    count = len(results_to_calculate)

    # Calculate totals
    total_obtained = sum(float(r.total_obtained) for r in results_to_calculate)
    if optional_result:
        total_obtained += float(optional_result.total_obtained)

    # Improved total_possible calculation based on individual subject maxima
    from .utils import _class_group, get_subject_maxima
    from decimal import Decimal

    group = _class_group(getattr(examination.classroom, "name", None))
    total_possible = 0
    for r in results_to_calculate:
        maxima = get_subject_maxima(group, getattr(r.subject, "name", None))
        if maxima:
            total_possible += (int(maxima.get("written", 0)) + int(maxima.get("mcq", 0)) + int(maxima.get("practical", 0)))
        else:
            total_possible += float(examination.total_marks)

    if optional_result:
        maxima = get_subject_maxima(group, getattr(optional_result.subject, "name", None))
        if maxima:
            total_possible += (int(maxima.get("written", 0)) + int(maxima.get("mcq", 0)) + int(maxima.get("practical", 0)))
        else:
            total_possible += float(examination.total_marks)

    percentage = (total_obtained / total_possible * 100) if total_possible > 0 else 0
    
    # Improved CGPA calculation with subject grouping (Bangla/English 1st+2nd count as 1)
    sum_gpa = 0
    grouped_subjects = {}

    for r in results_to_calculate:
        # Group subjects by their base name (e.g., "Bangla 1st" and "Bangla 2nd" -> "Bangla")
        name = r.subject.name.lower().strip()
        base_name = name

        # Check for Bangladesh and Global Studies (BGS) first to avoid grouping it with Bangla
        is_bgs = 'বাংলাদেশ' in name or 'bangladesh' in name or 'global studies' in name or 'bgs' in name

        if not is_bgs:
            if 'bangla' in name or 'বাংলা' in name:
                base_name = 'bangla'
            elif 'english' in name or 'english' in name or 'ইংরেজি' in name or 'ইংরেজী' in name:
                base_name = 'english'

        if base_name not in grouped_subjects:
            grouped_subjects[base_name] = []
        grouped_subjects[base_name].append(float(r.gpa))

    # Calculate average GPA for grouped subjects (like Bangla/English) and add others
    total_gp = 0
    subject_count = len(grouped_subjects)

    # Check if passed (all main subjects must be passed)
    is_passed = all(r.is_passed for r in results_to_calculate)
    has_fail = not is_passed

    for base_name, gpas in grouped_subjects.items():
        # In SSC standard, the GPA of combined subject is the average of its papers
        avg_subject_gp = sum(gpas) / len(gpas)
        if avg_subject_gp < 1.0:
            has_fail = True
        total_gp += avg_subject_gp

    bonus_points = 0
    if optional_result:
        bonus_points = max(0, float(optional_result.gpa) - 2)

    cgpa = (total_gp + bonus_points) / subject_count if (subject_count > 0 and not has_fail) else 0
    cgpa = min(5.0, cgpa) # Cap at 5.0
    
    # Update is_passed based on potential failure in grouped average GPA
    if has_fail:
        is_passed = False

    # Determine overall grade based on CGPA
    if cgpa >= 5.0:
        grade = 'A+'
    elif cgpa >= 4.0:
        grade = 'A'
    elif cgpa >= 3.5:
        grade = 'A-'
    elif cgpa >= 3.0:
        grade = 'B'
    elif cgpa >= 2.0:
        grade = 'C'
    elif cgpa >= 1.0:
        grade = 'D'
    else:
        grade = 'F'

    # Create or update overall result
    overall_result, created = StudentOverallResult.objects.update_or_create(
        examination=examination,
        student=student,
        defaults={
            'academic_year': examination.year,
            'total_marks_obtained': total_obtained,
            'total_marks_possible': total_possible,
            'percentage': percentage,
            'cgpa': cgpa,
            'grade': grade,
            'is_passed': is_passed
        }
    )
    
    # Calculate ranks for all students in this examination
    calculate_ranks(examination)


def calculate_ranks(examination):
    """
    Calculate and assign ranks to all students in an examination.
    Ranks are based on CGPA and total marks within each section.
    """
    from academics.models import Section
    
    # Get all sections associated with this examination's class
    sections = Section.objects.filter(classroom=examination.classroom)
    
    if sections.exists():
        for section in sections:
            # Get all overall results for this examination and this section, ordered by CGPA and percentage
            overall_results = StudentOverallResult.objects.filter(
                examination=examination,
                student__section=section
            ).order_by('-cgpa', '-percentage', '-total_marks_obtained')
            
            # Assign ranks within the section
            for rank, result in enumerate(overall_results, start=1):
                if result.rank != rank:
                    result.rank = rank
                    result.save(update_fields=['rank'])
    else:
        # Fallback to class-wide ranking if no sections are defined
        overall_results = StudentOverallResult.objects.filter(
            examination=examination
        ).order_by('-cgpa', '-percentage', '-total_marks_obtained')
        
        for rank, result in enumerate(overall_results, start=1):
            if result.rank != rank:
                result.rank = rank
                result.save(update_fields=['rank'])


@receiver(post_save, sender=Examination)
def recalculate_results_on_exam_change(sender, instance, created, **kwargs):
    """
    When an Examination is updated (e.g., total_marks or pass_marks changed),
    recalculate all related subject Result rows so grade/GPA/pass status reflect
    the latest exam configuration.
    """
    if created:
        return
    qs = Result.objects.filter(examination=instance)
    for r in qs.iterator():
        r.save()
