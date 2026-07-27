import random
import os
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.db.models import Count, Q
from django.contrib.auth.models import Permission
from .models import School, SchoolOnboarding, OnboardingClassConfig
from academics.models import ClassRoom, Section, StudentProfile, Subject, TeacherAssignment
from users.models import Profile
from results.models import Examination, ExamSlot

User = get_user_model()

def onboard_school(school_id):
    try:
        school = School.objects.get(id=school_id)
        onboarding = SchoolOnboarding.objects.get(school=school)
        if onboarding.is_processed:
            return False, "Already processed"

        # 1. Create Headmaster
        headmaster = create_headmaster(school, onboarding)

        # 2. Clone Curriculum (Subjects & Exams)
        clone_curriculum(school)

        # 3. Process Class Configs & Generate Students
        process_class_configs(school, onboarding)

        onboarding.is_processed = True
        onboarding.save()
        return True, "Onboarding successful"
    except Exception as e:
        return False, str(e)

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

    # Profile
    profile, _ = Profile.objects.get_or_create(
        user=user,
        defaults={
            'school': school,
            'role': 'admin',
            'designation': 'Headmaster'
        }
    )

    # Assign all permissions to allow CRUD in Admin
    permissions = Permission.objects.all()
    user.user_permissions.set(permissions)

    return user

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

    for config in onboarding.class_configs.all():
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

    Profile.objects.create(user=user, school=school, role='student', gender=gender)

    StudentProfile.objects.create(
        user=user,
        school=school,
        classroom=classroom,
        section=section,
        roll_number=str(roll),
        gender=gender
    )
