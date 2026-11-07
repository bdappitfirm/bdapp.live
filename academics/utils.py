import unicodedata
import random
import re

BANGLA_CLASS_ORDER_PATTERNS = [
    (r'প্লে|play', 1),
    (r'নুরানী', 2),
    (r'নাযেরা|হিফজ', 3),
    (r'নাসারী|নার্সারি|nursery|শিশু|shishu', 4),
    (r'কেজি|kg', 5),
    (r'প্রথম|১ম|\b1st\b|class\s*1|\bone\b', 6),
    (r'দ্বিতীয়|দ্বীতিয়| his|দ্বিতীয়|২য়|\b2nd\b|class\s*2|\btwo\b', 7),
    (r'তৃতীয়|তৃতীয়|৩য়|\b3rd\b|class\s*3|\bthree\b', 8),
    (r'চতুর্থ|৪র্থ|\b4th\b|class\s*4|\bfour\b', 9),
    (r'পঞ্চম|৫ম|\b5th\b|class\s*5|\bfive\b', 10),
    (r'ষষ্ঠ|৬ষ্ঠ|\b6th\b|class\s*6|\bsix\b', 11),
    (r'সপ্তম|৭ম|\b7th\b|class\s*7|\bseven\b', 12),
    (r'অষ্টম|৮ম|\b8th\b|class\s*8|\beight\b|অস্টম', 13),
    (r'নবম-দশম', 14),
    (r'নবম|৯ম|\b9th\b|class\s*9|\bnine\b', 15),
    (r'দশম|১০ম|\b10th\b|class\s*10|\bten\b', 16),
    (r'এস\.এস\.সি|এসএসসি|s\.s\.c|ssc|পরীক্ষার্থী', 17),
    (r'একাদশ|১১শ|\b11th\b|class\s*11|\beleven\b', 18),
    (r'দ্বাদশ|১২থ|১২-তম|\b12th\b|class\s*12|\btwelve\b', 19),
    (r'এইচএসসি|hsc|আলিম|আলীম', 20),
    (r'নন-শিক্ষা|স্নাতক|ফাজেল|কামেল', 21),
]

BANGLA_SECTION_MAP = {
    'ক': 1, 'খ': 2, 'গ': 3, 'ঘ': 4, 'ঙ': 5, 'চ': 6, 'ছ': 7, 'জ': 8,
    'বিজ্ঞান': 101,
    'মানবিক': 102,
    'ব্যবসায়': 103, 'ব্যবসায়': 103, 'ব্যবসায় শিক্ষা': 103, 'ব্যবসায় শিক্ষা': 103, 'ব্যবসায় শাখা': 103
}

def get_class_order(class_name):
    """
    Returns a sort tuple (base_rank, is_2027, cleaned_base_name) for sorting classes.
    """
    if not class_name:
        return (1, 999, '')

    n = unicodedata.normalize('NFKC', str(class_name)).strip().lower()
    is_2027 = 1 if ('2027' in n or '২০২৭' in n) else 0

    base_n = re.sub(r'[-–_]?\s*(2027|২০২৭)', '', n).strip()

    base_rank = 900
    for pattern, rank in BANGLA_CLASS_ORDER_PATTERNS:
        if re.search(pattern, base_n, re.IGNORECASE):
            base_rank = rank
            break

    if base_rank == 900:
        match = re.search(r'\d+', base_n)
        if match:
            base_rank = int(match.group(0))

    return (is_2027, base_rank, base_n)

def get_section_order(section_name):
    """
    Returns a numeric value representing logical section order ('ক', 'খ', 'গ', 'বিজ্ঞান' etc.)
    """
    if not section_name:
        return 999
    s = unicodedata.normalize('NFKC', str(section_name)).strip()
    if s in BANGLA_SECTION_MAP:
        return BANGLA_SECTION_MAP[s]
    if len(s) == 1 and 'A' <= s.upper() <= 'Z':
        return 200 + ord(s.upper())
    match = re.search(r'\d+', s)
    if match:
        return 300 + int(match.group(0))
    return 999

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


def generate_exam_seat_plan(examination, school, buildings_config, selected_classroom_ids=None):
    from results.models import Examination, ExamSlot
    from academics.models import StudentProfile, ExamSeatPlan
    from users.models import Profile

    update_student_genders(school=school)
    rooms = generate_exam_buildings_and_rooms(school, buildings_config)
    if not rooms: raise ValueError("No rooms available in building configuration")

    # 1. Identify all exams in the same session across selected classes
    is_morning = False
    ref_slots = ExamSlot.objects.filter(examination=examination)
    if any(s.start_time and s.start_time.hour < 12 for s in ref_slots):
        is_morning = True

    all_exams_in_group = Examination.objects.filter(
        school=school,
        exam_type=examination.exam_type,
        year=examination.year
    )

    if selected_classroom_ids:
        all_exams_in_group = all_exams_in_group.filter(classroom_id__in=selected_classroom_ids)

    session_exam_ids = []
    for ex in all_exams_in_group:
        ex_slots = ExamSlot.objects.filter(examination=ex)
        if not ex_slots.exists():
            session_exam_ids.append(ex.id)
        elif is_morning:
            if any(s.start_time and s.start_time.hour < 12 for s in ex_slots):
                session_exam_ids.append(ex.id)
        else:
            if any(s.start_time and s.start_time.hour >= 12 for s in ex_slots):
                session_exam_ids.append(ex.id)

    if not session_exam_ids:
        session_exam_ids = [examination.id]

    # Clear existing plans for the session pool
    ExamSeatPlan.objects.filter(examination_id__in=session_exam_ids).delete()

    # 2. Collect all students in the session and separate by gender
    session_exams = Examination.objects.filter(id__in=session_exam_ids)

    if selected_classroom_ids:
        students_qs = StudentProfile.objects.filter(school=school, classroom_id__in=selected_classroom_ids)
    else:
        classroom_ids = list(session_exams.values_list('classroom_id', flat=True))
        classroom_ids = [cid for cid in classroom_ids if cid is not None]
        if classroom_ids:
            students_qs = StudentProfile.objects.filter(school=school, classroom_id__in=classroom_ids)
        else:
            students_qs = StudentProfile.objects.filter(school=school)

    def arrange_globally(students_list):
        """Advanced Round-Robin interleaving to ensure NO same-class adjacency"""
        if not students_list: return []
        
        # Group by class
        by_class = {}
        for s in students_list:
            by_class.setdefault(s.classroom_id, []).append(s)

        # Sort each class by roll
        for cid in by_class:
            by_class[cid].sort(key=lambda x: (int(''.join(filter(str.isdigit, str(x.roll_number or '0'))) or '0')))

        # Prepare for Round-Robin
        arranged = []
        class_ids = sorted(by_class.keys())
        max_count = max([len(v) for v in by_class.values()]) if by_class else 0

        for i in range(max_count):
            current_cycle_classes = list(class_ids)
            random.shuffle(current_cycle_classes)

            for cid in current_cycle_classes:
                if i < len(by_class[cid]):
                    arranged.append(by_class[cid][i])
        return arranged

    def arrange_same_class(students_list):
        """Arrange students such that Bench 1 has [Science, Humanities, Commerce] and Bench 2 is reversed [Commerce, Humanities, Science]"""
        if not students_list: return []
        sci = [s for s in students_list if s.student_group == 'science']
        art = [s for s in students_list if s.student_group in ['arts', 'humanities']]
        com = [s for s in students_list if s.student_group == 'commerce']
        oth = [s for s in students_list if s.student_group not in ['science', 'arts', 'humanities', 'commerce']]

        def roll_key(x):
            digits = ''.join(filter(str.isdigit, str(x.roll_number or '0')))
            return int(digits) if digits else 0

        sci.sort(key=roll_key)
        art.sort(key=roll_key)
        com.sort(key=roll_key)
        oth.sort(key=roll_key)

        arranged = []
        bench_idx = 0
        streams = [sci, art, com, oth]

        while any(streams):
            triplet = []
            order = [0, 1, 2] if bench_idx % 2 == 0 else [2, 1, 0]

            for stream_pos in order:
                added = False
                pref_stream_idx = stream_pos # 0:sci, 1:art, 2:com
                if streams[pref_stream_idx]:
                    triplet.append(streams[pref_stream_idx].pop(0))
                    added = True
                else:
                    for alt_idx in range(4):
                        if streams[alt_idx]:
                            triplet.append(streams[alt_idx].pop(0))
                            added = True
                            break
                if not added:
                    break

            if triplet:
                arranged.extend(triplet)
                bench_idx += 1
            else:
                break
        return arranged

    # Separate rooms for Boys and Girls
    boys = list(students_qs.filter(gender='male')) + list(students_qs.exclude(gender__in=['male', 'female']))
    girls = list(students_qs.filter(gender='female'))

    is_single_class = False
    if selected_classroom_ids and len(selected_classroom_ids) == 1:
        is_single_class = True
    elif not selected_classroom_ids:
        cids = list(students_qs.values_list('classroom_id', flat=True).distinct())
        if len(cids) == 1:
            is_single_class = True

    arrange_func = arrange_same_class if is_single_class else arrange_globally

    final_boys = arrange_func(boys)
    final_girls = arrange_func(girls)

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
        r'বাংলাদেশ\s*ও\s*বিশ্বপরিচায়': 'বাংলাদেশ ও বিশ্বপরিচয়',
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
            subject.name = new_name
            try:
                subject.save(update_fields=['name'])
                updated_count += 1
            except Exception: pass
    return updated_count
