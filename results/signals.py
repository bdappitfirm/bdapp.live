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
    Skip if the student itself is being deleted (cascading delete).
    """
    from academics.models import StudentProfile
    try:
        # Check if student still exists to avoid crash during cascading delete
        if StudentProfile.objects.filter(pk=instance.student_id).exists():
            calculate_student_overall_result(instance.examination, instance.student)
    except (StudentProfile.DoesNotExist, AttributeError):
        pass


def calculate_student_overall_result(examination, student):
    """
    Calculate and save overall result for a student in an examination.
    This combines all subject results to calculate CGPA and overall grade.
    """
    from .utils import _class_group, get_subject_maxima
    from decimal import Decimal
    import re

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

    # Deduplicate and Filter by Group logic
    student_group = (student.student_group or "").lower()
    is_910 = _class_group(getattr(examination.classroom, "name", None)) == 'nine_ten'

    # 1. Group Filtering: For 9-10, only keep subjects that belong to the student's group
    valid_results = []
    SCIENCE_SUBJS = ['physics', 'chemistry', 'biology', 'higher math', 'পদার্থ', 'রসায়ন', 'জীব', 'উচ্চতর']
    COMMERCE_SUBJS = ['accounting', 'finance', 'business', 'হিসাব', 'ফিন্যান্স', 'ব্যবসায়']
    ARTS_SUBJS = ['history', 'geography', 'civics', 'economics', 'ইতিহাস', 'ভূগোল', 'পৌরনীতি', 'অর্থনীতি']

    # Track unique subjects to handle duplicates (keep the one with higher marks)
    best_results = {} # normalized_name -> result_object

    for r in all_results:
        name = r.subject.name.lower()

        if is_910 and student_group:
            if student_group == 'science' and any(kw in name for kw in (COMMERCE_SUBJS + ARTS_SUBJS)): continue
            if student_group == 'commerce' and any(kw in name for kw in (SCIENCE_SUBJS + ARTS_SUBJS)): continue
            if student_group == 'arts' and any(kw in name for kw in (SCIENCE_SUBJS + COMMERCE_SUBJS)): continue

        # Deduplication: normalized subject name as key
        norm_key = re.sub(r'\s*\(.*?\)\s*', '', name).strip()
        if norm_key not in best_results or float(r.total_obtained) > float(best_results[norm_key].total_obtained):
            best_results[norm_key] = r

    results_to_process = list(best_results.values())

    # Filter out excluded subjects for GPA
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

    for r in results_to_process:
        subject_name = r.subject.name.lower().strip()
        is_excluded = any(ex in subject_name for ex in EXCLUDED_SUBJECTS)
        if is_excluded:
            continue

        is_optional = False
        if optional_subject_id and r.subject_id == optional_subject_id:
            is_optional = True
        elif optional_subject_name:
            on = optional_subject_name.strip()
            if subject_name == on or subject_name.endswith(' ' + on) or subject_name.startswith(on + ' '):
                is_optional = True
            elif '(optional)' in subject_name or '(ঐচ্ছিক)' in subject_name:
                is_optional = True

        if is_optional:
            if optional_result is None or float(r.gpa) > float(optional_result.gpa):
                optional_result = r
        else:
            main_results.append(r)

    # Use deduplicated list for calculation
    results_to_calculate = main_results if main_results else results_to_process
    count = len(results_to_calculate)

    # Calculate totals (Main subjects only)
    total_obtained = sum(float(r.total_obtained) for r in results_to_calculate)

    # Improved total_possible calculation (Main subjects only)
    group = _class_group(getattr(examination.classroom, "name", None))
    total_possible = 0
    for r in results_to_calculate:
        maxima = get_subject_maxima(group, getattr(r.subject, "name", None))
        if maxima:
            total_possible += (int(maxima.get("written", 0)) + int(maxima.get("mcq", 0)) + int(maxima.get("practical", 0)))
        else:
            total_possible += float(examination.total_marks)

    # Optional Marks Bonus (Above 40%) - Following standard merit rules
    if optional_result:
        opt_obtained = float(optional_result.total_obtained)
        maxima = get_subject_maxima(group, getattr(optional_result.subject, "name", None))
        opt_possible = (int(maxima.get("written", 0)) + int(maxima.get("mcq", 0)) + int(maxima.get("practical", 0))) if maxima else 100
        opt_threshold = opt_possible * 0.4
        if opt_obtained > opt_threshold:
            total_obtained += (opt_obtained - opt_threshold)

    percentage = (total_obtained / total_possible * 100) if total_possible > 0 else 0
    
    PAPER_1_PAT = re.compile(r'(১ম|1st|first|১ম\s*পত্র|1st\s*paper)', re.IGNORECASE)
    PAPER_2_PAT = re.compile(r'(২য়|২য়|2nd|second|২য়\s*পত্র|২য়\s*পত্র|2nd\s*paper)', re.IGNORECASE)
    BANGLA_PAT  = re.compile(r'(bangla|বাংলা)', re.IGNORECASE)
    ENGLISH_PAT = re.compile(r'(english|ইংরেজি|ইংরেজী)', re.IGNORECASE)

    # 1st pass: Detect which groups actually have BOTH papers present
    paper_detector = {}
    for r in results_to_calculate:
        name = r.subject.name
        if BANGLA_PAT.search(name):
            grp = 'bangla'
        elif ENGLISH_PAT.search(name):
            grp = 'english'
        else:
            continue
        p1 = bool(PAPER_1_PAT.search(name))
        p2 = bool(PAPER_2_PAT.search(name))
        if grp not in paper_detector:
            paper_detector[grp] = {1: False, 2: False}
        if p1: paper_detector[grp][1] = True
        if p2: paper_detector[grp][2] = True

    sum_gpa = 0
    grouped_subjects = {}

    for r in results_to_calculate:
        name = r.subject.name
        # DEFAULT: each unique subject ID is its OWN group (SAFE for duplicates)
        group_key = f"__id_{r.subject_id}"

        # Only do Bangla/English 2-paper merge when BOTH 1st AND 2nd paper patterns EXIST
        if BANGLA_PAT.search(name):
            grp = 'bangla'
            if paper_detector.get(grp, {}).get(1) and paper_detector.get(grp, {}).get(2):
                if PAPER_1_PAT.search(name) or PAPER_2_PAT.search(name):
                    group_key = grp
        elif ENGLISH_PAT.search(name):
            grp = 'english'
            if paper_detector.get(grp, {}).get(1) and paper_detector.get(grp, {}).get(2):
                if PAPER_1_PAT.search(name) or PAPER_2_PAT.search(name):
                    group_key = grp

        if group_key not in grouped_subjects:
            grouped_subjects[group_key] = []
        grouped_subjects[group_key].append(float(r.gpa))

    # Calculate average GPA for grouped subjects and add others
    total_gp = 0
    subject_count = len(grouped_subjects)

    is_passed = all(r.is_passed for r in results_to_calculate)
    has_fail = not is_passed

    for gk, gpas in grouped_subjects.items():
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

    # Calculate failed subjects count for ranking
    # Improved logic: count both actual F and missing mandatory subjects
    failed_subjects_count = sum(1 for r in results_to_calculate if not r.is_passed)

    # Check for missing mandatory subjects (like BGS or Religion)
    mandatory_names = ['bangla', 'english', 'math', 'religion', 'ict', 'science', 'bgs']
    present_names = [r.subject.name.lower() for r in results_to_calculate]
    for m in mandatory_names:
        if not any(m in p for p in present_names):
            # Special check for religion
            if m == 'religion' and any(x in str(present_names) for x in ['islam', 'hindu', 'ধর্ম']): continue
            failed_subjects_count += 1

    # Create or update overall result
    try:
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
                'is_passed': is_passed,
                'failed_subjects_count': failed_subjects_count
            }
        )

        # Calculate ranks for all students in this examination
        calculate_ranks(examination)
    except Exception as e:
        # Avoid crashing during complex DB operations like cascading deletes
        print(f"Error updating overall result/ranks: {e}")


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
            # Get all overall results for this examination and this section
            # Priority: 1. Fails (asc), 2. Total Marks (desc), 3. CGPA (desc), 4. Percentage (desc)
            overall_results = StudentOverallResult.objects.filter(
                examination=examination,
                student__section=section
            ).order_by('failed_subjects_count', '-total_marks_obtained', '-cgpa', '-percentage')
            
            # Assign ranks within the section with tie-breaking logic
            last_rank = 0
            last_values = None
            for i, result in enumerate(overall_results, start=1):
                # Criteria for tie-breaking
                current_values = (
                    result.failed_subjects_count,
                    result.total_marks_obtained,
                    result.cgpa,
                    result.percentage
                )

                if current_values != last_values:
                    last_rank = i
                    last_values = current_values

                if result.rank != last_rank:
                    result.rank = last_rank
                    result.save(update_fields=['rank'])
    else:
        # Fallback to class-wide ranking if no sections are defined
        overall_results = StudentOverallResult.objects.filter(
            examination=examination
        ).order_by('failed_subjects_count', '-total_marks_obtained', '-cgpa', '-percentage')
        
        last_rank = 0
        last_values = None
        for i, result in enumerate(overall_results, start=1):
            current_values = (
                result.failed_subjects_count,
                result.total_marks_obtained,
                result.cgpa,
                result.percentage
            )

            if current_values != last_values:
                last_rank = i
                last_values = current_values

            if result.rank != last_rank:
                result.rank = last_rank
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
