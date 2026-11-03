import os
import sys
import re
import django

sys.path.insert(0, 'F:/bdedu')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from academics.models import ClassRoom, Section, Subject, TeacherAssignment, StudentProfile
from results.models import Result, ExamSlot

def is_preserved_subject(name):
    if not name:
        return False
    n = name.lower().strip()
    keywords = ['আরবী', 'আরবি', 'বই পড়া', 'বইপড়া', 'বই পড়া', 'word collection', 'achievement test']
    return any(kw in n for kw in keywords)

# Subject normalization mapping helper
NORMALIZATION_PATTERNS = [
    (r'বাংলা\s*[-–_]?\s*১ম|bangla\s*1st|বাংলা\s*১ম\s*পত্র', 'বাংলা প্রথম পত্র'),
    (r'বাংলা\s*[-–_]?\s*২য়|bangla\s*2nd|বাংলা\s*২য়\s*পত্র', 'বাংলা দ্বিতীয় পত্র'),
    (r'ইংরেজি\s*[-–_]?\s*১ম|ইংরেজী\s*[-–_]?\s*১ম|english\s*1st|ইংরেজি\s*১ম\s*পত্র', 'ইংরেজি প্রথম পত্র'),
    (r'ইংরেজি\s*[-–_]?\s*২য়|ইংরেজী\s*[-–_]?\s*২য়|english\s*2nd|ইংরেজি\s*২য়\s*পত্র', 'ইংরেজি দ্বিতীয় পত্র'),
    (r'উচ্চতর\s*গণিত|উচ্চতর\s*গনিত|higher\s*math', 'উচ্চতর গণিত'),
    (r'পদার্থ\s*বিজ্ঞান|physics', 'পদার্থবিজ্ঞান'),
    (r'জীব\s*বিজ্ঞান|biology', 'জীববিজ্ঞান'),
    (r'রসায়ন|chemistry', 'রসায়ন'),
    (r'বাংলাদেশ\s*ও\s*বিশ্বপরিচয়|বা\s*ইতিহাস\s*ও\s*বিশ্বসভ্যতা|সমাজ|bgs', 'বাংলাদেশ ও বিশ্বপরিচয়'),
    (r'বাংলাদেশের\s*ইতিহাস\s*ও\s*বিশ্বসভ্যতা', 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা'),
    (r'তথ্য\s*ও\s*যোগাযোগ\s*প্রযুক্তি|আইসিটি|ict', 'তথ্য ও যোগাযোগ প্রযুক্তি'),
    (r'ইসলাম\s*ও\s*নৈতিক\s*শিক্ষা|ইসলাম\s*শিক্ষা|ইসলামধর্ম', 'ইসলাম ও নৈতিক শিক্ষা'),
    (r'হিন্দু\s*ধর্ম|হিন্দুধর্ম\s*ও\s*নৈতিক\s*শিক্ষা', 'হিন্দুধর্ম ও নৈতিক শিক্ষা'),
    (r'শারীরিক\s*শিক্ষা|শরীর\s*চর্চা', 'শারীরিক শিক্ষা ও স্বাস্থ্য'),
    (r'হিসাব\s*বিজ্ঞান|accounting', 'হিসাববিজ্ঞান'),
    (r'ব্যবসায়\s*উদ্যোগ|business\s*entrepreneurship', 'ব্যবসায় উদ্যোগ'),
    (r'ফিন্যান্স\s*ও\s*ব্যাংকিং|finance', 'ফিন্যান্স ও ব্যাংকিং'),
    (r'ভূগোল\s*ও\s*পরিবেশ|ভুগোল|geography', 'ভূগোল ও পরিবেশ'),
    (r'পৌরনীতি\s*ও\s*নাগরিকতা|civics', 'পৌরনীতি ও নাগরিকতা'),
    (r'কৃষি\s*শিক্ষা|কৃষি|agriculture', 'কৃষি শিক্ষা'),
    (r'গার্হস্থ্য\s*বিজ্ঞান|গার্হস্থ্য|home\s*science', 'গার্হস্থ্য বিজ্ঞান'),
    (r'গণিত|গনিত|math|mathematics', 'গণিত'),
    (r'বিজ্ঞান|science', 'বিজ্ঞান'),
    (r'প্রাথমিক\s*বিজ্ঞান', 'প্রাথমিক বিজ্ঞান'),
    (r'অঙ্কন|অংকন|drawing', 'চিত্রাঙ্কন'),
]

def normalize_subject_name(name):
    if not name:
        return name
    n = name.strip()
    if is_preserved_subject(n):
        return n
    for pattern, std_name in NORMALIZATION_PATTERNS:
        if re.search(pattern, n, re.IGNORECASE):
            return std_name
    return n

def get_standard_subjects_for_classroom(class_name):
    c_lower = class_name.lower().strip()

    # Pre-Primary / Lower Primary
    if any(k in c_lower for k in ['প্লে', 'play', 'নুরানী', 'নাযেরা', 'হিফজ', 'নাসারী', 'nursery', 'শিশু', 'shishu']):
        return ['বাংলা', 'ইংরেজি', 'গণিত', 'চিত্রাঙ্কন']

    # Primary 1st & 2nd
    if any(k in c_lower for k in ['প্রথম', '১ম', '1st', 'class 1', 'দ্বিতীয়', '২য়', '2nd', 'class 2']):
        return ['বাংলা', 'ইংরেজি', 'গণিত']

    # Primary 3rd, 4th, 5th
    if any(k in c_lower for k in ['তৃতীয়', '৩য়', '3rd', 'class 3', 'চতুর্থ', '৪র্থ', '4th', 'class 4', 'পঞ্চম', '৫ম', '5th', 'class 5']):
        return ['বাংলা', 'ইংরেজি', 'গণিত', 'প্রাথমিক বিজ্ঞান', 'বাংলাদেশ ও বিশ্বপরিচয়', 'ইসলাম ও নৈতিক শিক্ষা']

    # Secondary 6th, 7th, 8th
    if any(k in c_lower for k in ['ষষ্ঠ', '৬ষ্ঠ', '6th', 'class 6', 'six', 'সপ্তম', '৭ম', '7th', 'class 7', 'seven', 'অষ্টম', '৮ম', '8th', 'class 8', 'eight', 'অস্টম']):
        return [
            'বাংলা প্রথম পত্র', 'বাংলা দ্বিতীয় পত্র', 'ইংরেজি প্রথম পত্র', 'ইংরেজি দ্বিতীয় পত্র',
            'গণিত', 'বিজ্ঞান', 'বাংলাদেশ ও বিশ্বপরিচয়', 'তথ্য ও যোগাযোগ প্রযুক্তি',
            'ইসলাম ও নৈতিক শিক্ষা', 'কৃষি শিক্ষা', 'গার্হস্থ্য বিজ্ঞান', 'স্বাস্থ্য সুরক্ষা', 'জীবন ও জীবিকা', 'শিল্প ও সংস্কৃতি'
        ]

    # High School 9th, 10th, SSC
    if any(k in c_lower for k in ['নবম', '৯ম', '9th', 'class 9', 'nine', 'দশম', '১০ম', '10th', 'class 10', 'ten', 's.s.c', 'ssc', 'পরীক্ষার্থী']):
        return [
            # Compulsory
            'বাংলা প্রথম পত্র', 'বাংলা দ্বিতীয় পত্র', 'ইংরেজি প্রথম পত্র', 'ইংরেজি দ্বিতীয় পত্র',
            'গণিত', 'তথ্য ও যোগাযোগ প্রযুক্তি', 'ইসলাম ও নৈতিক শিক্ষা', 'বাংলাদেশ ও বিশ্বপরিচয়', 'বিজ্ঞান',
            # Science
            'পদার্থবিজ্ঞান', 'রসায়ন', 'জীববিজ্ঞান', 'উচ্চতর গণিত',
            # Arts
            'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা', 'ভূগোল ও পরিবেশ', 'পৌরনীতি ও নাগরিকতা', 'অর্থনীতি',
            # Commerce
            'হিসাববিজ্ঞান', 'ব্যবসায় উদ্যোগ', 'ফিন্যান্স ও ব্যাংকিং',
            # Optional
            'কৃষি শিক্ষা', 'গার্হস্থ্য বিজ্ঞান'
        ]

    # Higher Secondary 11, 12, HSC, Alim
    if any(k in c_lower for k in ['একাদশ', '১১শ', '11th', 'class 11', 'দ্বাদশ', '১২শ', '12th', 'class 12', 'hsc', 'এইচএসসি', 'আলিম', 'আলীম']):
        return [
            'বাংলা প্রথম পত্র', 'বাংলা দ্বিতীয় পত্র', 'ইংরেজি প্রথম পত্র', 'ইংরেজি দ্বিতীয় পত্র', 'তথ্য ও যোগাযোগ প্রযুক্তি',
            'পদার্থবিজ্ঞান প্রথম পত্র', 'পদার্থবিজ্ঞান দ্বিতীয় পত্র', 'রসায়ন প্রথম পত্র', 'রসায়ন দ্বিতীয় পত্র',
            'জীববিজ্ঞান প্রথম পত্র', 'জীববিজ্ঞান দ্বিতীয় পত্র', 'উচ্চতর গণিত প্রথম পত্র', 'উচ্চতর গণিত দ্বিতীয় পত্র',
            'হিসাববিজ্ঞান প্রথম পত্র', 'হিসাববিজ্ঞান দ্বিতীয় পত্র', 'ব্যবসায় সংগঠন ও ব্যবস্থাপনা প্রথম পত্র', 'ব্যবসায় সংগঠন ও ব্যবস্থাপনা দ্বিতীয় পত্র',
            'অর্থনীতি প্রথম পত্র', 'অর্থনীতি দ্বিতীয় পত্র', 'পৌরনীতি ও সুশাসন প্রথম পত্র', 'পৌরনীতি ও সুশাসন দ্বিতীয় পত্র'
        ]

    # Default fallback
    return ['বাংলা', 'ইংরেজি', 'গণিত', 'বিজ্ঞান', 'তথ্য ও যোগাযোগ প্রযুক্তি', 'ইসলাম ও নৈতিক শিক্ষা']

print("=== DRY RUN TEST ===")
sample_school = School.objects.filter(id=19).first()
if sample_school:
    print(f"Testing for School 19 ({sample_school.name}):")
    existing_subjs = list(Subject.objects.filter(school=sample_school))
    print(f"Current subjects count in School 19: {len(existing_subjs)}")
    preserved = [s.name for s in existing_subjs if is_preserved_subject(s.name)]
    print(f"Preserved custom subjects in School 19: {preserved}")
