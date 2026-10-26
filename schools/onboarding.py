import random
import os
import unicodedata
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.db.models import Count, Q
from django.contrib.auth.models import Permission
from django.db import transaction
from .models import School, SchoolOnboarding, OnboardingClassConfig
from academics.models import ClassRoom, Section, StudentProfile, Subject, TeacherAssignment
from users.models import Profile
from results.models import Examination, ExamSlot, Result, StudentOverallResult

User = get_user_model()

def normalize_name(name):
    if not name: return ""
    return unicodedata.normalize('NFKC', str(name)).strip()

BOARD_PRIMARY_SUBJECTS = {
    'general': ['বাংলা', 'ইংরেজি', 'গণিত', 'পরিবেশ পরিচিতি', 'ধর্ম ও নৈতিক শিক্ষা', 'শারীরিক শিক্ষা', 'চারু ও কারুকলা'],
    'madrasah': ['কুরআন মাজিদ ও তাজবিদ', 'আরবি', 'বাংলা', 'ইংরেজি', 'গণিত', 'পরিবেশ পরিচিতি', 'আকাইদ ও ফিকহ']
}

BOARD_STANDARD_SUBJECTS = {
    'general': ['বাংলা-১ম', 'বাংলা-২য়', 'ইংরেজি-১ম', 'ইংরেজি-২য়', 'গণিত', 'বিজ্ঞান', 'বাংলাদেশ ও বিশ্বপরিচয়', 'ধর্ম ও নৈতিক শিক্ষা', 'তথ্য ও যোগাযোগ প্রযুক্তি', 'শারীরিক শিক্ষা ও স্বাস্থ্য', 'কর্ম ও জীবনমুখী শিক্ষা', 'চারু ও কারুকলা'],
    'science': ['বাংলা-১ম', 'বাংলা-২য়', 'ইংরেজি-১ম', 'ইংরেজি-২য়', 'গণিত', 'পদার্থবিজ্ঞান', 'রসায়ন', 'জীববিজ্ঞান', 'উচ্চতর গণিত', 'তথ্য ও যোগাযোগ প্রযুক্তি', 'ধর্ম ও নৈতিক শিক্ষা', 'বাংলাদেশ ও বিশ্বপরিচয়'],
    'humanities': ['বাংলা-১ম', 'বাংলা-২য়', 'ইংরেজি-১ম', 'ইংরেজি-২য়', 'তথ্য ও যোগাযোগ প্রযুক্তি', 'ধর্ম ও নৈতিক শিক্ষা', 'ইতিহাস', 'ভূগোল ও পরিবেশ', 'পৌরনীতি ও নাগরিকতা', 'অর্থনীতি', 'বিজ্ঞান', 'গণিত'],
    'commerce': ['বাংলা-১ম', 'বাংলা-২য়', 'ইংরেজি-১ম', 'ইংরেজি-২য়', 'তথ্য ও যোগাযোগ প্রযুক্তি', 'ধর্ম ও নৈতিক শিক্ষা', 'হিসাব বিজ্ঞান', 'ব্যবসায় উদ্যোগ', 'ফিন্যান্স ও ব্যাংকিং', 'বিজ্ঞান', 'গণিত', 'বাংলাদেশ ও বিশ্বপরিচয়'],
    'madrasah_general': ['কুরআন মাজিদ ও তাজবিদ', 'হাদিস শরিফ', 'ফিকহ ও উসুল-এ-ফিকহ', 'আরবি ১ম পত্র', 'আরবি ২য় পত্র', 'বাংলা-১ম', 'বাংলা-২য়', 'ইংরেজি-১ম', 'ইংরেজি-২য়', 'গণিত', 'সাধারণ বিজ্ঞান', 'বাংলাদেশ ও বিশ্বপরিচয়', 'তথ্য ও যোগাযোগ প্রযুক্তি'],
    'madrasah_science': ['কুরআন মাজিদ ও তাজবিদ', 'হাদিস শরিফ', 'ফিকহ ও উসুল-এ-ফিকহ', 'আরবি ১ম পত্র', 'আরবি ২য় পত্র', 'বাংলা-১ম', 'বাংলা-২য়', 'ইংরেজি-১ম', 'ইংরেজি-২য়', 'গণিত', 'পদার্থবিজ্ঞান', 'রসায়ন', 'জীববিজ্ঞান', 'তথ্য ও যোগাযোগ প্রযুক্তি'],
    'alim_general': ['কুরআন মাজিদ', 'হাদিস ও উসুলুল হাদিস', 'আল ফিকহ ১ম পত্র', 'আল ফিকহ ২য় পত্র', 'আরবি সাহিত্য', 'বালাগাত ও মানতিক', 'ইসলামের ইতিহাস', 'বাংলা-১ম', 'বাংলা-২য়', 'ইংরেজি-১ম', 'ইংরেজি-২য়', 'তথ্য ও যোগাযোগ প্রযুক্তি'],
    'alim_science': ['কুরআন মাজিদ', 'হাদিস ও উসুলুল হাদিস', 'আরবি সাহিত্য', 'পদার্থবিজ্ঞান ১ম পত্র', 'পদার্থবিজ্ঞান ২য় পত্র', 'রসায়ন ১ম পত্র', 'রসায়ন ২য় পত্র', 'জীববিজ্ঞান ১ম পত্র', 'জীববিজ্ঞান ২য় পত্র', 'উচ্চতর গণিত ১ম পত্র', 'উচ্চতর গণিত ২য় পত্র', 'বাংলা-১ম', 'বাংলা-২য়', 'ইংরেজি-১ম', 'ইংরেজি-২য়', 'তথ্য ও যোগাযোগ প্রযুক্তি']
}

@transaction.atomic
def onboard_school(school_id):
    try:
        school = School.objects.get(id=school_id)
        # Try to get onboarding, if not found, it might be a new school where inline wasn't saved
        onboarding = SchoolOnboarding.objects.filter(school=school).first()

        if not onboarding:
            return False, "Onboarding configuration missing. Please fill the Onboarding section in Admin."

        if onboarding.is_processed:
            return False, "Already processed"

        print(f"Starting onboarding for {school.name} (Type: {onboarding.school_type})")

        # Check if we have enough info to process
        has_range = onboarding.class_range_start is not None and onboarding.class_range_end is not None
        has_configs = onboarding.school.onboarding_configs.exists()
        has_headmaster = bool(onboarding.headmaster_name)

        if not (has_range or has_configs or has_headmaster):
            return False, "Insufficient data: Headmaster name or Class range is required."

        # 1. Create Headmaster
        headmaster_user = None
        if has_headmaster:
            headmaster_user = create_headmaster(school, onboarding)

        # 2. Auto-generate Classes and Subjects if range provided
        if has_range:
            auto_generate_classes_and_subjects(school, onboarding)

        # 3. Process Class Configs & Generate Students
        process_class_configs(school, onboarding)

        # 4. Create Sample Student if requested
        if onboarding.sample_student_count > 0:
            create_sample_student_and_result(school, onboarding)

        # 5. Ensure Headmaster shows up in teacher list
        if headmaster_user:
            classroom = ClassRoom.objects.filter(school=school).first()
            if classroom:
                subject = Subject.objects.filter(school=school, classrooms=classroom).first()
                if subject and not TeacherAssignment.objects.filter(teacher=headmaster_user).exists():
                    TeacherAssignment.objects.create(
                        teacher=headmaster_user,
                        classroom=classroom,
                        subject=subject,
                        section=Section.objects.filter(classroom=classroom).first()
                    )

        onboarding.is_processed = True
        onboarding.save()
        print(f"Onboarding completed for {school.name}")
        return True, "Onboarding successful"
    except Exception as e:
        import traceback
        error_msg = f"Error during onboarding for School {school_id}: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        return False, f"System Error: {str(e)}"

def create_headmaster(school, onboarding):
    # Unique username for headmaster
    username = f"headmaster_{school.id}"
    email = f"headmaster@{school.id}.com"

    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            'first_name': onboarding.headmaster_name or "Headmaster",
            'email': school.email or email,
            'is_staff': True,
            'password': make_password("12345678")
        }
    )

    if not created:
        user.is_staff = True
        user.save()

    if onboarding.headmaster_photo:
        user.photo = onboarding.headmaster_photo
        user.save()

    # Profile - Use update_or_create to handle signal-created profiles
    profile, _ = Profile.objects.update_or_create(
        user=user,
        defaults={
            'school': school,
            'role': 'admin',
            'designation': onboarding.headmaster_name or 'Headmaster'
        }
    )

    # Assign all permissions to allow CRUD in Admin
    permissions = Permission.objects.all()
    user.user_permissions.set(permissions)

    return user

def auto_generate_classes_and_subjects(school, onboarding):
    start = onboarding.class_range_start
    end = onboarding.class_range_end
    is_madrasah = onboarding.school_type == 'madrasah'

    for class_num in range(start, end + 1):
        if is_madrasah:
            if class_num <= 5: class_name = f"Ibtedayi {class_num}"
            elif class_num <= 10: class_name = f"Dakhil {class_num}"
            else: class_name = f"Alim {class_num - 10}st Year" if class_num == 11 else f"Alim {class_num - 10}nd Year"
        else:
            class_name = f"Class {class_num}"

        classroom, _ = ClassRoom.objects.get_or_create(school=school, name=class_name)

        if class_num >= 9:
            if is_madrasah:
                if class_num <= 10:
                    # Added 'মুজাব্বিদ' to make 3 sections for Madrasah
                    groups = [('বিজ্ঞান', 'madrasah_science'), ('সাধারণ', 'madrasah_general'), ('মুজাব্বিদ', 'madrasah_general')]
                else:
                    # Added 'মুজাব্বিদ' to make 3 sections for Alim
                    groups = [('বিজ্ঞান', 'alim_science'), ('সাধারণ', 'alim_general'), ('মুজাব্বিদ', 'alim_general')]
            else:
                groups = [('বিজ্ঞান', 'science'), ('মানবিক', 'humanities'), ('ব্যবসায় শিক্ষা', 'commerce')]

            for sec_name, group_key in groups:
                section, _ = Section.objects.get_or_create(classroom=classroom, name=sec_name)
                # Create subjects for this section
                subjects_list = BOARD_STANDARD_SUBJECTS.get(group_key, [])
                for sub_name in subjects_list:
                    norm_name = normalize_name(sub_name)
                    subject, _ = Subject.objects.get_or_create(school=school, name=norm_name)
                    subject.classrooms.add(classroom)
                    subject.sections.add(section)
        else:
            # Standard 3 sections: ক, খ, গ
            sections = ['ক', 'খ', 'গ']
            for sec_name in sections:
                section, _ = Section.objects.get_or_create(classroom=classroom, name=sec_name)
                # Create subjects for this section
                if class_num <= 5:
                    # Primary subjects (Simple names: বাংলা, ইংরেজি)
                    group_key = 'madrasah' if is_madrasah else 'general'
                    subjects_list = BOARD_PRIMARY_SUBJECTS.get(group_key, [])
                else:
                    # High school subjects (Board standard: বাংলা-১ম, বাংলা-২য় etc)
                    group_key = 'madrasah_general' if is_madrasah else 'general'
                    subjects_list = BOARD_STANDARD_SUBJECTS.get(group_key, [])

                for sub_name in subjects_list:
                    norm_name = normalize_name(sub_name)
                    subject, _ = Subject.objects.get_or_create(school=school, name=norm_name)
                    subject.classrooms.add(classroom)
                    subject.sections.add(section)

def clone_curriculum(school):
    # Find a "Template School" - use the one with most subjects
    template_school = School.objects.annotate(
        subj_count=Count('subjects'),
        exam_count=Count('examinations')
    ).exclude(id=school.id).order_by('-subj_count', '-exam_count').first()

    if not template_school:
        return

    # Map for cloned objects to maintain relationships
    classroom_map = {} # {old_id: new_obj}
    section_map = {} # {old_id: new_obj}
    subject_map = {} # {old_id: new_obj}

    # 1. Clone Classrooms & Sections first (if they don't exist)
    for old_cls in template_school.classrooms.all():
        new_cls, _ = ClassRoom.objects.get_or_create(
            school=school,
            name=old_cls.name,
            defaults={'description': old_cls.description}
        )
        classroom_map[old_cls.id] = new_cls

        for old_sec in old_cls.sections.all():
            new_sec, _ = Section.objects.get_or_create(
                classroom=new_cls,
                name=old_sec.name
            )
            section_map[old_sec.id] = new_sec

    # 2. Clone Subjects
    for old_sub in template_school.subjects.all():
        new_sub = Subject.objects.create(
            school=school,
            name=old_sub.name,
            code=old_sub.code
        )
        subject_map[old_sub.id] = new_sub

        # Link to new classrooms/sections
        for old_c in old_sub.classrooms.all():
            if old_c.id in classroom_map:
                new_sub.classrooms.add(classroom_map[old_c.id])
        for old_s in old_sub.sections.all():
            if old_s.id in section_map:
                new_sub.sections.add(section_map[old_s.id])

    # 3. Clone Examinations
    # Only clone from the current year or most recent
    recent_year = Examination.objects.filter(school=template_school).order_by('-year').values_list('year', flat=True).first()

    for old_exam in Examination.objects.filter(school=template_school, year=recent_year):
        if old_exam.classroom_id not in classroom_map: continue

        new_exam = Examination.objects.create(
            school=school,
            name=old_exam.name,
            exam_type=old_exam.exam_type,
            classroom=classroom_map[old_exam.classroom_id],
            section=section_map.get(old_exam.section_id),
            total_marks=old_exam.total_marks,
            pass_marks=old_exam.pass_marks,
            written_max=old_exam.written_max,
            mcq_max=old_exam.mcq_max,
            practical_max=old_exam.practical_max,
            year=old_exam.year
        )

        # Clone Slots
        for old_slot in old_exam.slots.all():
            if old_slot.subject_id not in subject_map: continue
            ExamSlot.objects.create(
                school=school,
                examination=new_exam,
                classroom=classroom_map[old_exam.classroom_id],
                section=section_map.get(old_exam.section_id),
                subject=subject_map[old_slot.subject_id],
                exam_date=old_slot.exam_date,
                start_time=old_slot.start_time,
                end_time=old_slot.end_time,
                room=old_slot.room
            )

def process_class_configs(school, onboarding):
    # Prepare Photo Pools
    photo_pool_male = list(User.objects.filter(profile__role='student', profile__gender='male', photo__isnull=False).exclude(photo='').values_list('photo', flat=True))
    photo_pool_female = list(User.objects.filter(profile__role='student', profile__gender='female', photo__isnull=False).exclude(photo='').values_list('photo', flat=True))

    def filter_by_color(pool, color):
        if not color or not pool: return pool
        c = str(color).lower().strip()
        matches = [p for p in pool if c in str(p).lower()]
        return matches if matches else pool

    for config in school.onboarding_configs.all():
        classroom, _ = ClassRoom.objects.get_or_create(school=school, name=config.class_name)
        section, _ = Section.objects.get_or_create(classroom=classroom, name=config.section_name)

        pool_m = filter_by_color(photo_pool_male, config.boy_dress_color)
        pool_f = filter_by_color(photo_pool_female, config.girl_dress_color)

        # Total students to generate
        total_students = config.boy_count + config.girl_count
        roll_counter = 1

        # Generate Boys
        for i in range(config.boy_count):
            create_student(school, classroom, section, roll_counter, 'male', pool_m)
            roll_counter += 1

        # Generate Girls
        for i in range(config.girl_count):
            create_student(school, classroom, section, roll_counter, 'female', pool_f)
            roll_counter += 1

def create_sample_student_and_result(school, onboarding):
    count = onboarding.sample_student_count
    if count <= 0:
        return

    is_madrasah = onboarding.school_type == 'madrasah'

    # Dynamically target the FIRST (lowest) classroom created for this school (e.g. Class 11 for Colleges, Class 9 or Class 6 for Schools)
    classroom = ClassRoom.objects.filter(school=school).order_by('id').first()
    if not classroom:
        classroom_name = 'Alim 1st Year' if is_madrasah else 'Class 11'
        classroom, _ = ClassRoom.objects.get_or_create(school=school, name=classroom_name)

    section, _ = Section.objects.get_or_create(classroom=classroom, name='বিজ্ঞান')

    for i in range(count):
        roll = f"{i+101}"
        gender = 'male'
        first_name = "Abdullah" if is_madrasah else f"Student {roll}"
        last_name = "Al Mamun" if is_madrasah else (section.name or "Student")

        username = f"std_{school.id}_{classroom.id}_{section.id}_{roll}"

        # Check if user already exists
        user = User.objects.filter(username=username).first()
        if not user:
            user = User.objects.create(
                username=username,
                first_name=first_name,
                last_name=last_name,
                password=make_password("12345678")
            )

        Profile.objects.update_or_create(user=user, defaults={'school': school, 'role': 'student', 'gender': gender})

        student_profile, _ = StudentProfile.objects.update_or_create(
            user=user,
            school=school,
            defaults={
                'classroom': classroom,
                'section': section,
                'roll_number': str(roll),
                'gender': gender,
                'father_name': 'Abdur Rahman' if is_madrasah else '',
                'mother_name': 'Fatema Begum' if is_madrasah else '',
                'student_group': 'science'
            }
        )

        # Create a sample exam and result
        exam_year = 2026
        exam, _ = Examination.objects.get_or_create(
            school=school,
            classroom=classroom,
            section=section,
            name=f"Annual Examination {exam_year}",
            defaults={'exam_type': 'annual', 'total_marks': 100, 'pass_marks': 33, 'year': exam_year}
        )

        # Ensure subjects are linked to this classroom/section for sample results
        group_key = 'madrasah_science' if is_madrasah else 'science'
        subjects_list = BOARD_STANDARD_SUBJECTS.get(group_key, [])
        for sub_name in subjects_list:
            norm_name = normalize_name(sub_name)
            subj, _ = Subject.objects.get_or_create(school=school, name=norm_name)
            subj.classrooms.add(classroom)
            subj.sections.add(section)

        subjects = Subject.objects.filter(school=school, classrooms=classroom, sections=section)
        total_obtained = Decimal('0')
        total_possible = Decimal('0')

        for subject in subjects:
            # Random but passing marks
            wm = Decimal(random.randint(45, 65))
            mm = Decimal(random.randint(20, 28))
            pr = Decimal(0)

            if 'বিজ্ঞান' in subject.name or 'Science' in subject.name or 'Phys' in subject.name or 'Chem' in subject.name or 'Bio' in subject.name:
                if 'Phys' in subject.name or 'Chem' in subject.name or 'Bio' in subject.name or 'বিজ্ঞান' in subject.name:
                     pr = Decimal(random.randint(18, 24))

            is_ict = 'ICT' in subject.name or 'তথ্য' in subject.name

            Result.objects.update_or_create(
                examination=exam,
                student=student_profile,
                subject=subject,
                defaults={
                    'written_marks': wm,
                    'mcq_marks': mm,
                    'practical_marks': pr,
                    'total_obtained': wm + mm + pr
                }
            )
            total_obtained += (wm + mm + pr)
            total_possible += 100 # Simplified for sample

        # Create Overall Result
        StudentOverallResult.objects.update_or_create(
            examination=exam,
            student=student_profile,
            defaults={
                'total_marks_obtained': total_obtained,
                'total_marks_possible': total_possible,
                'percentage': (total_obtained / total_possible * 100) if total_possible > 0 else 0,
                'is_passed': True,
                'academic_year': exam_year
            }
        )

def create_student(school, classroom, section, roll, gender, photo_pool):
    username = f"std_{school.id}_{classroom.id}_{section.id}_{roll}_{random.randint(100,999)}"
    first_name = f"Student {roll}"
    last_name = section.name

    user = User.objects.create(
        username=username,
        first_name=first_name,
        last_name=last_name,
        password=make_password("12345678")
    )

    if photo_pool:
        user.photo = random.choice(photo_pool)
        user.save(update_fields=['photo'])

    Profile.objects.update_or_create(user=user, defaults={'school': school, 'role': 'student', 'gender': gender})

    return StudentProfile.objects.create(
        user=user,
        school=school,
        classroom=classroom,
        section=section,
        roll_number=str(roll),
        gender=gender
    )
