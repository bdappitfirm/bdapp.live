import unicodedata
from .models import Building, Room, ExamSeatPlan
from results.models import ExamSlot
from academics.models import StudentProfile


def predict_gender_from_name(name):
    """
    Advanced gender prediction for Bangladeshi names.
    """
    if not name:
        return None
    
    name = unicodedata.normalize('NFKC', str(name)).strip().lower()
    name = name.replace('.', '').replace(':', '').replace('-', ' ')

    female_indicators = [
        'মোসাম্মৎ', 'মোসা', 'মোছাম্মৎ', 'মোছা', 'উম্মে', 'বিবি', 'সালেহা', 'তাকিয়া', 'মুনতাহা',
        'আক্তার', 'খাতুন', 'বেগম', 'নেছা', 'নেসা', 'রানি', 'রাণী', 'ভানু', 'লতা', 'মনি', 'মণি',
        'ফাতেমা', 'আয়েশা', 'মরিয়ম', 'জোহরা', 'খাদিজা', 'নুসরাত', 'তানিয়া', 'রিমা', 'মিতা',
        'আফরোজা', 'তাছনিয়া', 'তাসনিয়া', 'মালিহা', 'মাকনুন', 'তাসমিয়া', 'শ্রাবন্তী', 'তাহমিনা',
        'তাবাস্সুম', 'কাইফা', 'হুমাইরা', 'ইসরাত', 'মাইশা', 'লামিয়া', 'মরিয়ম', 'নুশরাত',
        'হাবিবা', 'নাজমুন', 'সিন্থিয়া', 'লিজা', 'কামরুন', 'জুবেইদা', 'হাফসা', 'জাকিয়া',
        'সানজিদা', 'মুনিয়া', 'মারিয়া', 'সুলতানা', 'আফরিন', 'নাজমা', 'রেহানা', 'পারভীন',
        'আলিয়া', 'সাদিয়া', 'তানহা', 'তাফসিয়া', 'নুহা', 'আদিবা', 'হারিফা', 'বিনতে', 'নাহার', 'নেহা', 'মুন',
        'akter', 'khatun', 'begum', 'bibi', 'mosammat', 'umme', 'rani', 'queen', 'fatema', 'ayesha',
        'jannat', 'mim', 'sumaiya', 'nusrat', 'mariya', 'israt', 'tania', 'sadia', 'binte'
    ]
    
    male_indicators = [
        'মোহাম্মদ', 'মো', 'মুহাম্মদ', 'মুহা', 'আব্দুল', 'আব্দুর', 'আবু', 'শেখ', 'সৈয়দ', 'কাজী',
        'রহমান', 'হাসান', 'হোসেন', 'আহমেদ', 'আহম্মেদ', 'ইসলাম', 'আলী', 'উল্লাহ', 'উদ্দিন', 'উদ্দীন',
        'খান', 'চৌধুরী', 'সরকার', 'পাটোয়ারী', 'আরিয়ান', 'আহসান', 'মামুন', 'সাদিক', 'জিসান', 'ফাহিম',
        'শাহাদাত', 'রাব্বি', 'জয়নাল', 'মোর্শেদ', 'রাহাত', 'আনাস', 'সাজ্জাদ', 'সৈকত', 'নিরব',
        'আইমন', 'মুরাদ', 'মাহী', 'ওয়াসিফ', 'রকি', 'সোহেল', 'রানা', 'মিরাজ', 'জুবায়েদ', 'রামন',
        'শাহ', 'আফনান', 'রেমন', 'মিনহাজ', 'আরাফাত', 'রব', 'রাগিব', 'রায়হান', 'আরিফ', 'রাজিন',
        'ইফাছ', 'ইফাত', 'তানবীর', 'জুবায়ের', 'তানভীর', 'ইফতেখার', 'সাকিব', 'সাদমান', 'সামি',
        'সায়ম্ন', 'রাহাদ', 'ইবনে', 'বিন', 'আমিন', 'আজাদ', 'ওমর',
        'mohammad', 'md', 'abdul', 'abdur', 'abu', 'rahman', 'hasan', 'hossain', 'ahmed', 'islam',
        'arayan', 'jishan', 'fahim', 'sadiq', 'sakib', 'tamim', 'tahsan', 'tanvir', 'ibne', 'bin'
    ]

    words = name.split()
    for word in words:
        if any(fi in word for ind in female_indicators if (fi := str(ind).lower()) in word):
            return 'female'
    for word in words:
        if any(mi in word for ind in male_indicators if (mi := str(ind).lower()) in word):
            return 'male'
    return None


def update_student_genders(school=None):
    """Update gender from profile first, then name prediction."""
    queryset = StudentProfile.objects.filter(gender__isnull=True) | StudentProfile.objects.filter(gender='N/A')
    if school: queryset = queryset.filter(school=school)

    updated_count = 0
    for student in queryset:
        # Check User Profile first
        try:
            from users.models import Profile
            up = Profile.objects.get(user=student.user)
            if up.gender:
                student.gender = up.gender
                student.save(update_fields=['gender'])
                updated_count += 1
                continue
        except Exception: pass

        # Fallback to name prediction
        full_name = f"{student.user.first_name} {student.user.last_name}".strip() or student.user.username
        predicted_gender = predict_gender_from_name(full_name)
        if predicted_gender:
            student.gender = predicted_gender
            student.save(update_fields=['gender'])
            updated_count += 1
    return updated_count


def generate_exam_buildings_and_rooms(school, buildings_config):
    all_rooms = []
    from .models import Room, Building
    for b_conf in buildings_config:
        b_num = b_conf.get('building_number', 1)
        building, _ = Building.objects.get_or_create(school=school, name=f"ভবন-{b_num}")
        for r_conf in b_conf.get('rooms', []):
            r_num = r_conf.get('room_number', 1)
            b_count = r_conf.get('bench_count', 15)
            cap = b_count * 3
            r_name = f"{b_num}{r_num:02d}"
            room, _ = Room.objects.get_or_create(building=building, name=r_name, defaults={'capacity': cap})
            if room.capacity != cap:
                room.capacity = cap
                room.save(update_fields=['capacity'])
            all_rooms.append(room)
    return all_rooms


def generate_exam_seat_plan(examination, school, buildings_config):
    from results.models import Examination, ExamSlot
    update_student_genders(school=school)
    rooms = generate_exam_buildings_and_rooms(school, buildings_config)
    if not rooms: raise ValueError("No rooms available")

    all_related_exams = Examination.objects.filter(school=school, name=examination.name)
    ExamSeatPlan.objects.filter(examination__in=all_related_exams).delete()

    morning_classes = []
    afternoon_classes = []
    for exam in all_related_exams:
        slots = ExamSlot.objects.filter(examination=exam)
        if any(s.start_time and s.start_time.hour < 12 for s in slots):
            morning_classes.append(exam.classroom_id)
        else:
            afternoon_classes.append(exam.classroom_id)

    def assign_session(students_qs, session_name, room_list):
        # Separate by gender
        boys_qs = students_qs.filter(gender='male')
        girls_qs = students_qs.filter(gender='female')
        unknowns_qs = students_qs.exclude(gender__in=['male', 'female'])
        
        def interleave_students(qs):
            # Group by class
            class_groups = {}
            for s in qs:
                class_groups.setdefault(s.classroom_id, []).append(s)

            # Sort students within each class by roll
            for cid in class_groups:
                class_groups[cid].sort(key=lambda x: (int(''.join(filter(str.isdigit, x.roll_number or '0')) or '0')))

            interleaved = []
            c_ids = sorted(class_groups.keys())
            max_len = max([len(v) for v in class_groups.values()]) if class_groups else 0

            # Pick one student from each class in cycles
            for i in range(max_len):
                for cid in c_ids:
                    if i < len(class_groups[cid]):
                        interleaved.append(class_groups[cid][i])
            return interleaved

        boys = interleave_students(boys_qs) + interleave_students(unknowns_qs)
        girls = interleave_students(girls_qs)

        total_rooms = len(room_list)
        b_ratio = len(boys) / (len(boys) + len(girls)) if (len(boys) + len(girls)) > 0 else 0.5
        b_count = max(1, min(total_rooms - 1, round(total_rooms * b_ratio))) if (boys and girls) else (total_rooms if boys else 0)

        b_rooms = room_list[:b_count]
        g_rooms = room_list[b_count:]

        res = []
        # Assign Boys
        r_idx = 0; s_num = 1
        for s in boys:
            if r_idx >= len(b_rooms): break
            r = b_rooms[r_idx]
            ex = next((e for e in all_related_exams if e.classroom_id == s.classroom_id), examination)
            res.append(ExamSeatPlan.objects.create(examination=ex, student=s, room=r, seat_number=str(s_num), session=session_name))
            s_num += 1
            if s_num > r.capacity: s_num = 1; r_idx += 1
            
        # Assign Girls
        r_idx = 0; s_num = 1
        for s in girls:
            if r_idx >= len(g_rooms): break
            r = g_rooms[r_idx]
            ex = next((e for e in all_related_exams if e.classroom_id == s.classroom_id), examination)
            res.append(ExamSeatPlan.objects.create(examination=ex, student=s, room=r, seat_number=str(s_num), session=session_name))
            s_num += 1
            if s_num > r.capacity: s_num = 1; r_idx += 1
        return res

    m_students = StudentProfile.objects.filter(school=school, classroom_id__in=morning_classes)
    a_students = StudentProfile.objects.filter(school=school, classroom_id__in=afternoon_classes)

    return assign_session(m_students, 'morning', rooms) + assign_session(a_students, 'afternoon', rooms)
