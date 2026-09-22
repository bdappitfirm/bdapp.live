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

    # Helpers for combined slash-separated subject names (e.g. Physics/Geography/Accounting)
    SCI_KW = ['physics', 'chemistry', 'biology', 'higher math', 'পদার্থ', 'রসায়ন', 'জীব', 'উচ্চতর']
    COM_KW = ['accounting', 'finance', 'business', 'হিসাব', 'ফিন্যান্স', 'ব্যবসায়']
    ART_KW = ['history', 'geography', 'civics', 'economics', 'ইতিহাস', 'ভূগোল', 'পৌরনীতি', 'অর্থনীতি']

    def _classify_part(part):
        p = (part or '').strip().lower()
        if not p: return None
        if any(k in p for k in SCI_KW): return 'science'
        if any(k in p for k in COM_KW): return 'commerce'
        if any(k in p for k in ART_KW): return 'arts'
        return None

    def _effective_subject(name, sgroup):
        n = (name or '').strip()
        if not n or '/' not in n: return n
        parts = [pt.strip() for pt in n.split('/') if pt.strip()]
        if not parts: return n
        if not sgroup: return parts[0]
        for pt in parts:
            if _classify_part(pt) == sgroup:
                return pt
        return parts[0]

    # 1. Group Filtering: For 9-10, only keep subjects that belong to the student's group
    valid_results = []
    SCIENCE_SUBJS = ['physics', 'chemistry', 'biology', 'higher math', 'পদার্থ', 'রসায়ন', 'জীব', 'উচ্চতর']
    COMMERCE_SUBJS = ['accounting', 'finance', 'business', 'হিসাব', 'ফিন্যান্স', 'ব্যবসায়']
    ARTS_SUBJS = ['history', 'geography', 'civics', 'economics', 'ইতিহাস', 'ভূগোল', 'পৌরনীতি', 'অর্থনীতি']

    # Track unique subjects to handle duplicates (keep the one with higher marks)
    best_results = {} # normalized_name -> result_object

    def is_religion(n):
        if not n: return False
        # Remove invisible characters and normalize
        n_clean = "".join(c for c in str(n) if not (0x200B <= ord(c) <= 0x200D or ord(c) == 0xFEFF))
        n_low = n_clean.lower().strip()
        # Check for any religion keyword
        keywords = ['religion', 'islam', 'hindu', 'buddhist', 'christian', 'ধর্ম', 'ইসলাম', 'হিন্দু', 'বৌদ্ধ', 'খ্রিস্ট', 'খ্রিষ্ট', 'মরাল', 'moral']
        return any(kw in n_low for kw in keywords)

    for r in all_results:
        name = r.subject.name

        if is_910 and student_group:
            eff_name = _effective_subject(name, student_group)
            eff_low = eff_name.lower()
            if student_group == 'science' and any(kw in eff_low for kw in (COMMERCE_SUBJS + ARTS_SUBJS)): continue
            if student_group == 'commerce' and any(kw in eff_low for kw in (SCIENCE_SUBJS + ARTS_SUBJS)): continue
            if student_group == 'arts' and any(kw in eff_low for kw in (SCIENCE_SUBJS + COMMERCE_SUBJS)): continue

        # Special logic for Religion: keep only ONE religion record (the one with marks)
        if is_religion(name):
            norm_key = 'religion_merged'
        else:
            # Deduplication: normalized subject name as key
            norm_key = re.sub(r'\s*\(.*?\)\s*', '', name.lower()).strip()

        if norm_key not in best_results or float(r.total_obtained) > float(best_results[norm_key].total_obtained):
            best_results[norm_key] = r

    results_to_process = list(best_results.values())

    # 2nd pass deduplication for Religion (ensure we don't have multiple religion names)
    rel_results = [r for r in results_to_process if is_religion(r.subject.name)]
    if len(rel_results) > 1:
        rel_results.sort(key=lambda x: -float(x.total_obtained))
        best_rel = rel_results[0]
        results_to_process = [r for r in results_to_process if not is_religion(r.subject.name)] + [best_rel]

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

    group = _class_group(getattr(examination.classroom, "name", None))

    # Calculate literal total obtained marks for display (Main subjects only)
    literal_total_obtained = sum(float(r.total_obtained) for r in results_to_calculate)

    # Calculate internal total for GPA calculation (Main subjects only)
    total_obtained_for_gpa = sum(float(r.total_obtained) for r in results_to_calculate)

    if group == 'primary':
        tutorial_total = sum(float(r.mcq_marks) for r in results_to_calculate if r.mcq_marks is not None)
        literal_total_obtained += tutorial_total
        # NOTE: total_obtained_for_gpa intentionally excludes tutorial_total so tutorial has zero effect on GPA/CGPA

    # Improved total_possible calculation (Main subjects only)
    total_possible = 0
    for r in results_to_calculate:
        maxima = get_subject_maxima(group, getattr(r.subject, "name", None), student_group if is_910 else None)
        if group == 'primary':
            total_possible += (int(maxima.get("written", 100)) if maxima else 100)
        else:
            if maxima:
                total_possible += (int(maxima.get("written", 0)) + int(maxima.get("mcq", 0)) + int(maxima.get("practical", 0)))
            else:
                total_possible += float(examination.total_marks)

    # Optional Marks Bonus (Above 40%) - Following standard merit rules
    bonus_marks = 0
    if optional_result:
        opt_obtained = float(optional_result.total_obtained)
        maxima = get_subject_maxima(group, getattr(optional_result.subject, "name", None), student_group if is_910 else None)
        opt_possible = (int(maxima.get("written", 0)) + int(maxima.get("mcq", 0)) + int(maxima.get("practical", 0))) if maxima else 100
        opt_threshold = opt_possible * 0.4
        if opt_obtained > opt_threshold:
            bonus_marks = (opt_obtained - opt_threshold)
            total_obtained_for_gpa += bonus_marks

    percentage = (total_obtained_for_gpa / total_possible * 100) if total_possible > 0 else 0
    
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
    failed_subjects_count = 0
    failed_subjects_list = []

    # RELIGION SPECIAL CASE: A student passes 'Religion' if they pass ANY religion subject
    religion_subjects = [r for r in results_to_calculate if is_religion(r.subject.name)]
    has_any_religion_pass = any(r.is_passed for r in religion_subjects)

    for r in results_to_calculate:
        if is_religion(r.subject.name):
            # Only count as fail if ALL religion subjects are failed
            if not has_any_religion_pass:
                # To avoid duplicate 'Religion' in failed list, only add for the first record
                if r == religion_subjects[0]:
                    failed_subjects_count += 1
                    failed_subjects_list.append("ধর্ম")
        elif not r.is_passed:
            failed_subjects_count += 1
            failed_subjects_list.append(r.subject.name)

    # Check for missing mandatory subjects (Bangla/English/Math/Religion/ICT/Science/BGS)
    mandatory_keywords = {
        'bangla': (['bangla', 'বাংলা'], 'বাংলা'),
        'english': (['english', 'ইংরেজি', 'ইংরেজী'], 'ইংরেজি'),
        'math': (['math', 'গণিত', 'গনিত'], 'গণিত'),
    } if group == 'primary' else {
        'bangla': (['bangla', 'বাংলা'], 'বাংলা'),
        'english': (['english', 'ইংরেজি', 'ইংরেজী'], 'ইংরেজি'),
        'math': (['math', 'গণিত', 'গনিত'], 'গণিত'),
        'religion': (['religion', 'ধর্ম', 'islam', 'hindu', 'ইসলাম', 'হিন্দু', 'buddhist', 'christian', 'বৌদ্ধ', 'খ্রিস্ট', 'খ্রিষ্ট'], 'ধর্ম'),
        'ict': (['ict', 'আইসিটি', 'তথ্য'], 'আইসিটি'),
        'science': (['science', 'বিজ্ঞান'], 'বিজ্ঞান'),
        'bgs': (['bgs', 'bangladesh', 'global', 'বাংলাদেশ', 'বিশ্বপরিচয়', 'বিশ্বপরিচয়', 'সমাজ'], 'বাংলাদেশ ও বিশ্বপরিচয়')
    }

    present_names_str = " ".join([r.subject.name.lower() for r in results_to_calculate])
    # Pre-clean string for robust matching
    present_names_str = "".join(c for c in present_names_str if not (0x200B <= ord(c) <= 0x200D or ord(c) == 0xFEFF))

    for m, (keywords, label) in mandatory_keywords.items():
        # Check if ANY keyword from this mandatory group is present in the student's results
        if not any(kw in present_names_str for kw in keywords):
            # Special case for 9-10 science: they take BGS, others take Science
            if is_910:
                if m == 'science' and student_group == 'science': continue
                if m == 'bgs' and student_group != 'science' and student_group: continue

            # Special case for Religion: if they have any religion pass, don't mark as missing
            if m == 'religion' and has_any_religion_pass: continue

            failed_subjects_count += 1
            failed_subjects_list.append(label)

    # Deduplicate failed subjects list
    failed_subjects_list = list(set(failed_subjects_list))

    # Determine if passed
    is_passed_overall = (failed_subjects_count == 0) and all(r.is_passed for r in results_to_calculate if not is_religion(r.subject.name))
    if is_passed_overall and religion_subjects and not has_any_religion_pass:
        is_passed_overall = False

    # RE-SYNC literal_total_obtained to include ALL subjects (Main + Optional + CA)
    # This sum matches what users see in Result Card / Class Results
    # Use results_to_process which contains ALL valid subjects before optional/excluded filtering
    literal_total_obtained = sum(float(r.total_obtained) for r in results_to_process)

    # Create or update overall result
    try:
        # Force delete existing to ensure clean recalculation without stale data
        StudentOverallResult.objects.filter(examination=examination, student=student).delete()

        overall_result = StudentOverallResult.objects.create(
            examination=examination,
            student=student,
            academic_year=examination.year,
            total_marks_obtained=literal_total_obtained,
            total_marks_possible=total_possible,
            percentage=percentage,
            cgpa=cgpa,
            grade=grade,
            is_passed=is_passed_overall,
            failed_subjects_count=failed_subjects_count,
            failed_subjects_list=failed_subjects_list
        )

        # Calculate ranks for all students in this examination
        calculate_ranks(examination)
    except Exception as e:
        # Avoid crashing during complex DB operations like cascading deletes
        print(f"Error updating overall result/ranks: {e}")


def calculate_ranks(examination):
    """
    Calculate and assign ranks to all students in an examination, grouped by section.
    Ranks are based on:
    1. Fewer Fails (Mandatory subjects)
    2. Higher CGPA
    3. Higher Total Marks Obtained
    4. Lower Roll Number
    """
    from academics.models import Section
    import re

    def get_roll_num(roll_str):
        if not roll_str: return 999999
        try:
            return int(re.sub(r'\D', '', str(roll_str)))
        except:
            return 999999

    # Get all sections associated with this examination's class
    sections = list(Section.objects.filter(classroom=examination.classroom))
    
    if sections:
        for section in sections:
            # Get all overall results for this section
            overall_results = list(StudentOverallResult.objects.filter(
                examination=examination,
                student__section=section
            ))

            # Sort in Python to handle complex logic and roll number parsing
            overall_results.sort(key=lambda x: (
                x.failed_subjects_count,
                -float(x.cgpa),
                -float(x.total_marks_obtained),
                get_roll_num(x.student.roll_number)
            ))

            # Assign ranks within section with tie-breaking
            last_rank = 0
            last_values = None
            for i, result in enumerate(overall_results, start=1):
                current_values = (
                    result.failed_subjects_count,
                    float(result.cgpa),
                    float(result.total_marks_obtained)
                )

                if current_values != last_values:
                    last_rank = i
                    last_values = current_values

                if result.rank != last_rank:
                    result.rank = last_rank
                    result.save(update_fields=['rank'])
    else:
        # Fallback to class-wide if no sections
        overall_results = list(StudentOverallResult.objects.filter(
            examination=examination
        ))
        overall_results.sort(key=lambda x: (
            x.failed_subjects_count,
            -float(x.cgpa),
            -float(x.total_marks_obtained),
            get_roll_num(x.student.roll_number)
        ))
        last_rank = 0
        last_values = None
        for i, result in enumerate(overall_results, start=1):
            current_values = (result.failed_subjects_count, float(result.cgpa), float(result.total_marks_obtained))
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
