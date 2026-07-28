import unicodedata
import random
import re

def update_student_genders(school=None):
    """Update gender from profile if missing."""
    from academics.models import StudentProfile
    from users.models import Profile
    queryset = StudentProfile.objects.filter(gender__isnull=True) | StudentProfile.objects.filter(gender='N/A')
    if school: queryset = queryset.filter(school=school)

    updated_count = 0
    for student in queryset:
        try:
            up = Profile.objects.get(user=student.user)
            if up.gender:
                student.gender = up.gender
                student.save(update_fields=['gender'])
                updated_count += 1
        except Exception: pass
    return updated_count


def generate_exam_buildings_and_rooms(school, buildings_config):
    all_rooms = []
    from academics.models import Room, Building
    
    # First, get all building numbers from config
    config_building_numbers = [b_conf.get('building_number', 1) for b_conf in buildings_config]
    
    # Delete any existing buildings not in the config
    existing_buildings = list(Building.objects.filter(school=school))
    for building in existing_buildings:
        match = re.search(r'\d+', building.name)
        if match:
            b_num = int(match.group(0))
            if b_num not in config_building_numbers:
                building.delete()
    
    for b_conf in buildings_config:
        b_num = b_conf.get('building_number', 1)
        building, _ = Building.objects.get_or_create(school=school, name=f"ভবন-{b_num}")
        
        # Get all rooms from the config for this building
        config_rooms = b_conf.get('rooms', [])
        config_room_names = [r.get('room_name', f"{b_num * 100 + r.get('room_number', 1)}") for r in config_rooms]
        
        # Delete any existing rooms that are not in the config
        existing_rooms = list(Room.objects.filter(building=building))
        for room in existing_rooms:
            if room.name not in config_room_names:
                room.delete()
        
        # Process each room in the config
        for r_conf in config_rooms:
            r_num = r_conf.get('room_number', 1)
            b_count = r_conf.get('bench_count', 15)
            cap = b_count * 3
            r_name = r_conf.get('room_name', f"{b_num * 100 + r_num}")
            room, created = Room.objects.get_or_create(
                building=building, 
                name=r_name, 
                defaults={'capacity': cap}
            )
            if room.capacity != cap:
                room.capacity = cap
                room.save(update_fields=['capacity'])
            all_rooms.append(room)
    return all_rooms


def generate_exam_seat_plan(examination, school, buildings_config):
    from results.models import Examination, ExamSlot
    from academics.models import StudentProfile, ExamSeatPlan
    from users.models import Profile

    update_student_genders(school=school)
    rooms = generate_exam_buildings_and_rooms(school, buildings_config)
    if not rooms: raise ValueError("No rooms available")

    # 1. Identify all exams in the same session across all classes (6-10)
    is_morning = False
    ref_slots = ExamSlot.objects.filter(examination=examination)
    if any(s.start_time and s.start_time.hour < 12 for s in ref_slots):
        is_morning = True

    # Get all exams of this type and year in the same school
    all_exams_in_group = Examination.objects.filter(
        school=school,
        exam_type=examination.exam_type,
        year=examination.year
    )

    # Filter to only include exams belonging to this specific morning/afternoon session
    session_exam_ids = []
    for ex in all_exams_in_group:
        ex_slots = ExamSlot.objects.filter(examination=ex)
        if is_morning:
            if any(s.start_time and s.start_time.hour < 12 for s in ex_slots):
                session_exam_ids.append(ex.id)
        else:
            if any(s.start_time and s.start_time.hour >= 12 for s in ex_slots):
                session_exam_ids.append(ex.id)

    # If no slots defined, fallback to just the current exam's group
    if not session_exam_ids:
        session_exam_ids = [examination.id]

    # Clear existing plans for the entire session pool
    ExamSeatPlan.objects.filter(examination_id__in=session_exam_ids).delete()

    # 2. Collect all students in the session and separate by gender
    session_exams = Examination.objects.filter(id__in=session_exam_ids)
    classroom_ids = list(session_exams.values_list('classroom_id', flat=True))
    students_qs = StudentProfile.objects.filter(school=school, classroom_id__in=classroom_ids)

    def arrange_globally(students_list):
        """Advanced Round-Robin interleaving to ensure NO same-class adjacency"""
        if not students_list: return []
        
        # Group by class
        by_class = {}
        for s in students_list:
            by_class.setdefault(s.classroom_id, []).append(s)

        # Sort each class by roll
        for cid in by_class:
            by_class[cid].sort(key=lambda x: (int(''.join(filter(str.isdigit, x.roll_number or '0')) or '0')))

        # Prepare for Round-Robin
        arranged = []
        class_ids = sorted(by_class.keys())
        max_count = max([len(v) for v in by_class.values()]) if by_class else 0

        for i in range(max_count):
            # In each cycle, pick one student from each class
            # We shuffle the order of classes in each cycle to prevent predictable patterns
            current_cycle_classes = list(class_ids)
            random.shuffle(current_cycle_classes)

            for cid in current_cycle_classes:
                if i < len(by_class[cid]):
                    arranged.append(by_class[cid][i])
        return arranged

    # Separate rooms for Boys and Girls
    boys = list(students_qs.filter(gender='male')) + list(students_qs.exclude(gender__in=['male', 'female']))
    girls = list(students_qs.filter(gender='female'))

    final_boys = arrange_globally(boys)
    final_girls = arrange_globally(girls)

    # 3. Room Distribution
    total_rooms = len(rooms)
    b_count = len(final_boys)
    g_count = len(final_girls)

    if b_count > 0 and g_count > 0:
        ratio = b_count / (b_count + g_count)
        b_rooms_count = max(1, min(total_rooms - 1, round(total_rooms * ratio)))
        b_rooms = rooms[:b_rooms_count]
        g_rooms = rooms[b_rooms_count:]
    else:
        b_rooms = rooms if b_count > 0 else []
        g_rooms = rooms if g_count > 0 else []

    def assign_to_db(students, room_list, session_label):
        res = []
        s_ptr = 0
        for r in room_list:
            for seat_num in range(1, r.capacity + 1):
                if s_ptr >= len(students): break
                s = students[s_ptr]
                # Match correct exam object for this student
                ex = next((e for e in session_exams if e.classroom_id == s.classroom_id), examination)
                res.append(ExamSeatPlan.objects.create(
                    examination=ex, student=s, room=r, seat_number=str(seat_num), session=session_label
                ))
                s_ptr += 1
        return res

    return assign_to_db(final_boys, b_rooms, 'morning' if is_morning else 'afternoon') + \
           assign_to_db(final_girls, g_rooms, 'morning' if is_morning else 'afternoon')


def standardize_subject_names():
    from academics.models import Subject
    import re

    mapping = {
        # Patterns for replacement
        r'বাংলা\s*[-–]?\s*১ম': 'বাংলা প্রথম পত্র',
        r'বাংলা\s*[-–]?\s*২য়': 'বাংলা দ্বিতীয় পত্র',
        r'bangla\s*1st': 'বাংলা প্রথম পত্র',
        r'bangla\s*2nd': 'বাংলা দ্বিতীয় পত্র',
        r'ইংরেজি\s*[-–]?\s*১ম': 'ইংরেজি প্রথম পত্র',
        r'ইংরেজি\s*[-–]?\s*২য়': 'ইংরেজি দ্বিতীয় পত্র',
        r'ইংরেজী\s*[-–]?\s*১ম': 'ইংরেজি প্রথম পত্র',
        r'ইংরেজী\s*[-–]?\s*২য়': 'ইংরেজি দ্বিতীয় পত্র',
        r'english\s*1st': 'ইংরেজি প্রথম পত্র',
        r'english\s*2nd': 'ইংরেজি দ্বিতীয় পত্র',
        r'গনিত': 'গণিত',
        r'উচ্চতর\s*গনিত': 'উচ্চতর গণিত',
        r'পদার্থ\s*বিজ্ঞান': 'পদার্থবিজ্ঞান',
        r'জীব\s*বিজ্ঞান': 'জীববিজ্ঞান',
        r'ভৌত\s*বিজ্ঞান': 'বিজ্ঞান',
        r'বাংলাদেশ\s*ও\s*বিশ্বপরিচয়': 'বাংলাদেশ ও বিশ্বপরিচয়',
        r'বা\s*ইতিহাস\s*ও\s*বিশ্বসভ্যতা': 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা',
        r'সমাজ': 'বাংলাদেশ ও বিশ্বপরিচয়',
        r'সমাজ\s*বিজ্ঞান': 'সমাজবিজ্ঞান',
        r'তথ্য\s*ও\s*যোগাযোগ\s*প্রযুক্তি': 'তথ্য ও যোগাযোগ প্রযুক্তি',
        r'আইসিটি': 'তথ্য ও যোগাযোগ প্রযুক্তি',
        r'ict': 'তথ্য ও যোগাযোগ প্রযুক্তি',
        r'ইসলাম\s*ও\s*নৈতিক\s*শিক্ষা': 'ইসলাম ও নৈতিক শিক্ষা',
        r'ইসলাম\s*শিক্ষা': 'ইসলাম ও নৈতিক শিক্ষা',
        r'ইসলামধর্ম': 'ইসলাম ও নৈতিক শিক্ষা',
        r'হিন্দু\s*ধর্ম': 'হিন্দুধর্ম ও নৈতিক শিক্ষা',
        r'গার্হস্থ্য': 'গার্হস্থ্য বিজ্ঞান',
        r'শারীরিক\s*শিক্ষা': 'শারীরিক শিক্ষা ও স্বাস্থ্য',
        r'শরীর\s*চর্চা': 'শারীরিক শিক্ষা ও স্বাস্থ্য',
        r'হিসাব\s*বিজ্ঞান': 'হিসাববিজ্ঞান',
        r'ব্যবসায়\s*উদ্যোগ': 'ব্যবসায় উদ্যোগ',
        r'ফিন্যান্স\s*ও\s*ব্যাংকিং': 'ফিন্যান্স ও ব্যাংকিং',
        r'ভুগোল': 'ভূগোল ও পরিবেশ',
        r'পৌরনীতি\s*ও\s*নাগরিকতা': 'পৌরনীতি ও নাগরিকতা',
        r'পৌরনীতি\s*ও\s*সুশাসন': 'পৌরনীতি ও সুশাসন',
        r'কুরআন': 'কুরআন মাজীদ ও তাজবীদ',
        r'হাদীস': 'হাদীস ও উসূলুল হাদীস',
        r'আকাইদ': 'আকাইদ ও ফিকহ',
        r'আরবি\s*[-–]?\s*১ম': 'আরবি প্রথম পত্র',
        r'आरবি\s*[-–]?\s*১ম': 'আরবি প্রথম পত্র',
        r'আরবি\s*[-–]?\s*২য়': 'আরবি দ্বিতীয় পত্র',
    }

    subjects = Subject.objects.all()
    updated_count = 0
    for subject in subjects:
        original_name = subject.name
        new_name = original_name

        for pattern, replacement in mapping.items():
            if re.search(pattern, original_name, re.IGNORECASE):
                new_name = replacement
                break

        if new_name != original_name:
            # Simple rename
            subject.name = new_name
            try:
                subject.save(update_fields=['name'])
                updated_count += 1
            except Exception: pass
    return updated_count
