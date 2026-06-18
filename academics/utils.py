from .models import Building, Room, ExamSeatPlan
from results.models import ExamSlot
from academics.models import StudentProfile


def predict_gender_from_name(name):
    """
    Predict gender from Bengali or English name using common patterns
    Returns 'male', 'female', or None
    """
    if not name:
        return None
    
    name = name.strip().lower()
    
    # Bengali female name suffixes
    bengali_female_suffixes = [
        'রানি', 'রাণী', 'দেবী', 'দেবি', 'প্রিয়া', 'প্রিয়া', 'সুন্দরী', 'লতা', 'লতা',
        'মনি', 'মণি', 'প্রভা', 'প্রভা', 'সম্প্রীতি', 'সম্প্রীতি', 'আরতি', 'আরতি',
        'কাঞ্চনা', 'কাঞ্চনা', 'নিতা', 'নিতা', 'সুমনা', 'সুমনা', 'পার্বতী', 'পার্বতী',
        'সরস্বতী', 'সরস্বতী', 'লক্ষ্মী', 'লক্ষ্মী', 'দুর্গা', 'দুর্গা', 'কালী', 'কালী',
        'স্বপ্না', 'স্বপ্না', 'নাজনীন', 'নাজনীন', 'ফাতেমা', 'ফাতেমা', 'আয়শা', 'আয়শা',
        'মরিয়ম', 'মরিয়ম', 'জান্নাত', 'জান্নাত', 'সাবরিনা', 'সাবরিনা', 'নাহিদ', 'নাহিদ',
        'তাসনিয়া', 'তাসনিয়া', 'মুহাম্মাদা', 'মুহাম্মাদা', 'আফরিন', 'আফরিন', 'শ্রাবণী', 'শ্রাবণী',
        'অর্পিতা', 'অর্পিতা', 'সৌরভী', 'সৌরভী', 'অনিন্দিতা', 'অনিন্দিতা', 'রিমা', 'রিমা',
        'পুষ্পিতা', 'পুষ্পিতা', 'সুমনি', 'সুমনি', 'সুমনা', 'সুমনা', 'রূপা', 'রূপা',
        'পাপিয়া', 'পাপিয়া', 'মিঠু', 'মিঠু', 'কনক', 'কনক', 'স্নিগ্ধা', 'স্নিগ্ধা',
        'অনুপমা', 'অনুপমা', 'অনুরাধা', 'অনুরাধা', 'সুভাষিনী', 'সুভাষিনী', 'বুবাই', 'বুবাই',
        'মিতা', 'মিতা', 'নন্দিতা', 'নন্দিতা', 'দীপ্তি', 'দীপ্তি', 'মৌসুমী', 'মৌসুমী',
        'শিমুল', 'শিমুল', 'নুসরাত', 'নুসরাত', 'সাবিয়া', 'সাবিয়া', 'জারিন', 'জারিন',
        'শিরীন', 'শিরীন', 'জুবাইদা', 'জুবাইদা', 'রুকিয়া', 'রুকিয়া', 'আনোয়ারা', 'আনোয়ারা',
        'আসমা', 'আসমা', 'হাফেজা', 'হাফেজা', 'জোহরা', 'জোহরা', 'মালেকা', 'মালেকা',
        'সালমা', 'সালমা', 'আজমেরা', 'আজমেরা', 'রোশনা', 'রোশনা', 'রেবেকা', 'রেবেকা',
        'সেলিনা', 'সেলিনা', 'এলিনা', 'এলিনা', 'মেরিনা', 'মেরিনা', 'রিনা', 'রিনা',
        'শারমিন', 'শারমিন', 'শারমিনা', 'শারমিনা', 'ফারহানা', 'ফারহানা', 'নাফিসা', 'নাফিসা',
        'আফসানা', 'আফসানা', 'সাবরিন', 'সাবরিন', 'তামান্না', 'তামান্না', 'আয়েশা', 'আয়েশা',
        'মাহবুবা', 'মাহবুবা', 'ফাহমিদা', 'ফাহমিদা', 'নূরজাহান', 'নূরজাহান', 'নায়না', 'নায়না',
        'মিম', 'মিম', 'মিথু', 'মিথু', 'প্রীতি', 'প্রীতি', 'স্মৃতি', 'স্মৃতি',
        'নীতি', 'নীতি', 'সংগীতা', 'সংগীতা', 'মোহনা', 'মোহনা', 'সুভ্রতা', 'সুভ্রতা',
        'অপূর্বা', 'অপূর্বা', 'অর্চনা', 'অর্চনা', 'অর্পিতা', 'অর্পিতা', 'অন্কিতা', 'অন্কিতা',
        'অন্বেষা', 'অন্বেষা', 'অদিতি', 'অদিতি', 'অন্যা', 'অন্যা', 'অন্বিতা', 'অন্বিতা',
        'অপু', 'অপু', 'অপুর্বা', 'অপুর্বা', 'অর্চা', 'অর্চা', 'অর্চনা', 'অর্চনা',
        'অর্পিতা', 'অর্পিতা', 'অনিন্দিতা', 'অনিন্দিতা', 'অনুপমা', 'অনুপমা', 'অনুরাধা', 'অনুরাধা',
        'rani', 'devi', 'priya', 'sundari', 'lata', 'moni', 'probha', 'samriti', 'arti',
        'kanchana', 'nita', 'sumona', 'parvati', 'saraswati', 'lakshmi', 'durga', 'kali',
        'swapna', 'nazneen', 'fatema', 'aisha', 'maryam', 'jannat', 'sabrina', 'nahid',
        'tasnia', 'muhammada', 'afrin', 'shrabani', 'arpita', 'sauravi', 'anindita', 'rima',
        'pushpita', 'sumoni', 'rupa', 'papia', 'mithu', 'konok', 'snigdha', 'anupoma',
        'anuradha', 'subhashini', 'bubai', 'mita', 'nandita', 'dipti', 'mousumi', 'shimul',
        'nusrat', 'sabia', 'jarin', 'shirin', 'zubaida', 'rukiya', 'anwara', 'asma',
        'hafeza', 'johora', 'maleka', 'salma', 'ajmera', 'roshna', 'rebeka', 'selina',
        'elina', 'merina', 'rina', 'sharmin', 'farhana', 'nafisa', 'afsana', 'tamnna',
        'mahebooba', 'fahmida', 'noorjahan', 'nayna', 'mim', 'priti', 'smriti', 'niti',
        'sangeeta', 'mohona', 'subrota', 'apurba', 'archana', 'ankita', 'anvesha', 'aditi'
    ]
    
    # Bengali male name suffixes/prefixes
    bengali_male_suffixes = [
        'কুমার', 'কুমার', 'দাস', 'দাস', 'চন্দ্র', 'চন্দ্র', 'নাথ', 'নাথ', 'রঞ্জন', 'রঞ্জন',
        'প্রসাদ', 'প্রসাদ', 'লাল', 'লাল', 'মোহন', 'মোহন', 'সুর', 'সুর', 'দেব', 'দেব',
        'নারায়ণ', 'নারায়ণ', 'কান্ত', 'কান্ত', 'ভূষণ', 'ভূষণ', 'রায়', 'রায়', 'চৌধুরী', 'চৌধুরী',
        'সারকার', 'সারকার', 'সিংহ', 'সিংহ', 'বর্মন', 'বর্মন', 'দেবনাথ', 'দেবনাথ', 'প্রভাকর', 'প্রভাকর',
        'আব্দুল', 'আব্দুল', 'মোহাম্মদ', 'মোহাম্মদ', 'মুহাম্মদ', 'মুহাম্মদ', 'হাসান', 'হাসান', 'হোসেন', 'হোসেন',
        'রহমান', 'রহমান', 'করিম', 'করিম', 'জব্বার', 'জব্বার', 'আলম', 'আলম', 'উদ্দিন', 'উদ্দিন',
        'ফারুক', 'ফারুক', 'সেলিম', 'সেলিম', 'সোহেল', 'সোহেল', 'শফিকুল', 'শফিকুল', 'রফিকুল', 'রফিকুল',
        'মোস্তফা', 'মোস্তফা', 'মোসলেম', 'মোসলেম', 'আহমেদ', 'আহমেদ', 'আলী', 'আলী', 'হাফিজ', 'হাফিজ',
        'মিজানুর', 'মিজানুর', 'রিয়াজ', 'রিয়াজ', 'শাহিন', 'শাহিন', 'নাজমুল', 'নাজমুল', 'মাহবুব', 'মাহবুব',
        'ফাহাদ', 'ফাহাদ', 'নাহিদ', 'নাহিদ', 'শোয়েব', 'শোয়েব', 'রাজু', 'রাজু', 'সোহাগ', 'সোহাগ',
        'অনিক', 'অনিক', 'অনীর্বন', 'অনীর্বন', 'অর্পিত', 'অর্পিত', 'অর্চন', 'অর্চন', 'অবির', 'অবির',
        'অভিজিৎ', 'অভিজিৎ', 'অদিত্য', 'অদিত্য', 'অনন্ত', 'অনন্ত', 'অনির্বাণ', 'অনির্বাণ', 'অন্কিত', 'অন্কিত',
        'অন্বেষ', 'অন্বেষ', 'অপুর্ব', 'অপুর্ব', 'অর্চন', 'অর্চন', 'অর্পিত', 'অর্পিত', 'অনিন্দিত', 'অনিন্দিত',
        'অনুপম', 'অনুপম', 'অনুরাধ', 'অনুরাধ', 'সুভাষ', 'সুভাষ', 'বুবাই', 'বুবাই', 'মিত', 'মিত',
        'নন্দিত', 'নন্দিত', 'দীপ্ত', 'দীপ্ত', 'মৌসুম', 'মৌসুম', 'শিমুল', 'শিমুল', 'নুসরাত', 'নুসরাত',
        'সাবিয়া', 'সাবিয়া', 'জারিন', 'জারিন', 'শিরীন', 'শিরীন', 'জুবাইদ', 'জুবাইদ', 'রুকিয়া', 'রুকিয়া',
        'আনোয়ার', 'আনোয়ার', 'আসম', 'আসম', 'হাফেজ', 'হাফেজ', 'জোহর', 'জোহর', 'মালেক', 'মালেক',
        'সালম', 'সালম', 'আজমের', 'আজমের', 'রোশন', 'রোশন', 'রেবেক', 'রেবেক', 'সেলিন', 'সেলিন',
        'এলিন', 'এলিন', 'মেরিন', 'মেরিন', 'রিন', 'রিন', 'শারমিন', 'শারমিন', 'ফারহান', 'ফারহান',
        'নাফিস', 'নাফিস', 'আফসান', 'আফসান', 'সাবরিন', 'সাবরিন', 'তামান্ন', 'তামান্ন', 'আয়েশ', 'আয়েশ',
        'মাহবুব', 'মাহবুব', 'ফাহমিদ', 'ফাহমিদ', 'নূরজাহান', 'নূরজাহান', 'নায়ন', 'নায়ন', 'মিম', 'মিম',
        'মিথু', 'মিথু', 'প্রীত', 'প্রীত', 'স্মৃতি', 'স্মৃতি', 'নীতি', 'নীতি', 'সংগীত', 'সংগীত',
        'মোহন', 'মোহন', 'সুভ্রত', 'সুভ্রত', 'অপূর্ব', 'অপূর্ব', 'অর্চন', 'অর্চন', 'অর্পিত', 'অর্পিত',
        'kumar', 'das', 'chandra', 'nath', 'ranjan', 'prasad', 'lal', 'mohan', 'sur', 'deb',
        'narayan', 'kant', 'bhushan', 'ray', 'chowdhury', 'sarkar', 'singha', 'barman', 'debnath',
        'prabhakar', 'abdul', 'mohammad', 'hasan', 'hossain', 'rahman', 'karim', 'jabbar', 'alam',
        'uddin', 'faruk', 'selim', 'sohel', 'shafiqul', 'rafiqul', 'mostafa', 'moslem', 'ahmed',
        'ali', 'hafiz', 'mizanur', 'riaz', 'shahin', 'nazmul', 'mahebub', 'fahad', 'nahid',
        'shoaib', 'raju', 'sohag', 'anik', 'anirban', 'arpit', 'arpan', 'abir', 'abhijit',
        'aditya', 'ananta', 'anirban', 'ankit', 'anvesh', 'apurba', 'arpan', 'arpit', 'anindit',
        'anupam', 'anuradha', 'subhash', 'bubai', 'mit', 'nandit', 'dipto', 'mousum', 'shimul',
        'nusrat', 'sabia', 'jarin', 'shirin', 'zubaid', 'rukiya', 'anwar', 'asm', 'hafez',
        'johor', 'malek', 'salm', 'ajmer', 'roshn', 'rebeb', 'selin', 'elin', 'merin', 'rin',
        'sharmin', 'farhan', 'nafis', 'afsan', 'sabrin', 'tamnna', 'ayesh', 'mahebub', 'fahmid',
        'noorjahan', 'nayon', 'mim', 'mithu', 'prit', 'smriti', 'niti', 'sangeet', 'mohan',
        'subroto', 'apurbo', 'archan'
    ]
    
    # Common English female names/suffixes
    english_female = [
        'a', 'anne', 'ann', 'belle', 'ella', 'elle', 'emma', 'eva', 'eve', 'fiona',
        'grace', 'hannah', 'isabella', 'jane', 'jennifer', 'jessica', 'julia', 'julie',
        'kate', 'katherine', 'laura', 'lily', 'lucy', 'maria', 'mary', 'olivia', 'sarah',
        'sophia', 'sophie', 'victoria'
    ]
    
    # Common English male names/suffixes
    english_male = [
        'john', 'james', 'robert', 'michael', 'william', 'david', 'richard', 'joseph',
        'thomas', 'charles', 'daniel', 'matthew', 'anthony', 'donald', 'mark', 'paul',
        'steven', 'andrew', 'kenneth', 'joshua', 'george', 'kevin', 'brian', 'edward',
        'ronald', 'timothy', 'jason', 'jeffrey', 'ryan', 'jacob', 'nicholas', 'eric',
        'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel',
        'frank', 'alexander', 'raymond', 'patrick', 'jack', 'dennis', 'jerry', 'tyler',
        'aaron', 'jose', 'adam', 'harry', 'henry', 'zachary', 'dylan', 'alan', 'nathan',
        'wayne', 'ethan', 'max', 'leo', 'mason', 'logan', 'lucas', 'elijah', 'oliver'
    ]
    
    # Check for Bengali female suffixes first
    for suffix in bengali_female_suffixes:
        if suffix in name:
            return 'female'
    
    # Check for Bengali male suffixes
    for suffix in bengali_male_suffixes:
        if suffix in name:
            return 'male'
    
    # Split name into parts for English checks
    name_parts = name.split()
    
    # Check English female
    for part in name_parts:
        for female_name in english_female:
            if female_name in part:
                return 'female'
    
    # Check English male
    for part in name_parts:
        for male_name in english_male:
            if male_name in part:
                return 'male'
    
    # If no match, return None
    return None


def update_student_genders(school=None):
    """
    Update gender for students without gender based on their name
    """
    queryset = StudentProfile.objects.filter(gender__isnull=True)
    if school:
        queryset = queryset.filter(school=school)
    
    updated_count = 0
    for student in queryset:
        # Get full name
        full_name = f"{student.user.first_name} {student.user.last_name}".strip()
        if not full_name:
            full_name = student.user.username
        
        predicted_gender = predict_gender_from_name(full_name)
        if predicted_gender:
            student.gender = predicted_gender
            student.save(update_fields=['gender'])
            updated_count += 1
    
    return updated_count


def generate_exam_buildings_and_rooms(school, num_buildings, num_rooms_per_building, room_capacity=40):
    """Generate buildings and rooms for a school"""
    buildings = []
    for b in range(1, num_buildings + 1):
        building, created = Building.objects.get_or_create(
            school=school,
            name=f"ভবন {b}"
        )
        buildings.append(building)

        for r in range(1, num_rooms_per_building + 1):
            room_name = f"কক্ষ {b}-{r}"
            Room.objects.get_or_create(
                building=building,
                name=room_name,
                defaults={'capacity': room_capacity}
            )

    return buildings


def generate_exam_seat_plan(exam_slot, num_buildings, num_rooms_per_building, room_capacity=40):
    """
    Generate a gender-segregated exam seat plan for an exam slot
    
    Args:
        exam_slot: ExamSlot instance
        num_buildings: Number of buildings to use/generate
        num_rooms_per_building: Number of rooms per building
        room_capacity: Capacity per room
    """
    school = exam_slot.school or exam_slot.examination.school
    if not school:
        raise ValueError("Exam slot must be associated with a school")

    # Generate buildings and rooms if needed
    generate_exam_buildings_and_rooms(school, num_buildings, num_rooms_per_building, room_capacity)

    # Get all students for this exam slot
    if exam_slot.section:
        students = StudentProfile.objects.filter(
            school=school,
            classroom=exam_slot.classroom,
            section=exam_slot.section
        )
    else:
        students = StudentProfile.objects.filter(
            school=school,
            classroom=exam_slot.classroom
        )

    # Separate boys and girls
    male_students = list(students.filter(gender='male').order_by('roll_number'))
    female_students = list(students.filter(gender='female').order_by('roll_number'))

    # Get all rooms
    rooms = Room.objects.filter(building__school=school).order_by('building__name', 'name')
    if not rooms.exists():
        raise ValueError("No rooms available for seat plan")

    # Delete any existing seat plan for this slot
    ExamSeatPlan.objects.filter(exam_slot=exam_slot).delete()

    # Assign seats - first all male students, then all female students
    current_room_idx = 0
    current_seat_in_room = 1

    # Assign male students
    for student in male_students:
        room = rooms[current_room_idx]
        ExamSeatPlan.objects.create(
            exam_slot=exam_slot,
            student=student,
            room=room,
            seat_number=str(current_seat_in_room),
            gender_segregated=True
        )
        current_seat_in_room += 1
        if current_seat_in_room > room.capacity:
            current_seat_in_room = 1
            current_room_idx = (current_room_idx + 1) % len(rooms)

    # Assign female students
    for student in female_students:
        room = rooms[current_room_idx]
        ExamSeatPlan.objects.create(
            exam_slot=exam_slot,
            student=student,
            room=room,
            seat_number=str(current_seat_in_room),
            gender_segregated=True
        )
        current_seat_in_room += 1
        if current_seat_in_room > room.capacity:
            current_seat_in_room = 1
            current_room_idx = (current_room_idx + 1) % len(rooms)

    return ExamSeatPlan.objects.filter(exam_slot=exam_slot)
