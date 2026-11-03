import os
import sys
import re
import unicodedata
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import transaction
from django.db.models import Q
from schools.models import School
from academics.models import ClassRoom, Section, Subject, TeacherAssignment, StudentProfile, VirtualClass
from users.models import Profile, AdminProfile, ParentProfile, CommitteeProfile
from results.models import Result, ExamSlot

def clean_str(val):
    if not val:
        return ''
    # Normalize unicode to NFKC
    s = unicodedata.normalize('NFKC', str(val)).strip()
    s = s.replace('নাগরিকতা', 'নাগরিকতা').replace('পৌরনীতি', 'পৌরনীতি').replace('পৌরণীতি', 'পৌরনীতি')
    s = s.replace('বাংলাদেশ ও বিশ্বপরিচয়', 'বাংলাদেশ ও বিশ্বপরিচয়')
    s = s.replace('রসায়ন', 'রসায়ন')
    s = s.replace('ব্যবসায়', 'ব্যবসায়')
    s = s.replace('ইংরেজি-২য় পত্র', 'ইংরেজি দ্বিতীয় পত্র')
    return s

def is_preserved_subject(name):
    if not name:
        return False
    n = clean_str(name).lower()
    keywords = ['আরবী', 'আরবি', 'বই পড়া', 'বইপড়া', 'বই পড়া', 'word collection', 'achievement test']
    return any(kw in n for kw in keywords)

EXACT_CANONICAL_MAP = {
    'ইংরেজি-২য়': 'ইংরেজি দ্বিতীয় পত্র',
    'ইংরেজি-২য়': 'ইংরেজি দ্বিতীয় পত্র',
    'ইংরেজি-২য় পত্র': 'ইংরেজি দ্বিতীয় পত্র',
    'বাঃ ইতিহাস ও বিশ্বসভ্যতা': 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা',
    'ব্যবসায় শিক্ষা': 'ব্যবসায় উদ্যোগ',
    'ব্যবসায় উদ্যোগ': 'ব্যবসায় উদ্যোগ',
    'পৌরনীতি ও নাগরিকতা': 'পৌরনীতি ও নাগরিকতা',
    'পৌরনীতি ও नागरिकতা': 'পৌরনীতি ও নাগরিকতা',
    'রসায়ন': 'রসায়ন',
    'বাংলাদেশ ও বিশ্বপরিচয়': 'বাংলাদেশ ও বিশ্বপরিচয়',
}

NORMALIZATION_PATTERNS = [
    # English subjects
    (r'career\s*education|কর্ম\s*ও\s*জীবনমুখী\s*শিক্ষা', 'ক্যারিয়ার শিক্ষা'),
    (r'islam\s*and\s*moral\s*education|ইসলাম\s*ও\s*নৈতিক\s*শিক্ষা|ইসলাম\s*শিক্ষা|ইসলামধর্ম|ইসলাম$|ধর্ম\s*ও\s*নৈতিক\s*শিক্ষা|ধর্ম$', 'ইসলাম ও নৈতিক শিক্ষা'),
    (r'physical\s*education\s*and\s*health|শারীরিক\s*শিক্ষা\s*ও\s*স্বাস্থ্য|শারীরিক\s*শিক্ষা|শরীর\s*চর্চা', 'শারীরিক শিক্ষা ও স্বাস্থ্য'),

    # Bangla 1st & 2nd
    (r'বাংলা\s*[-–_]?\s*১ম|bangla\s*1st|বাংলা\s*১ম\s*পত্র|বাংলা\s*১ম', 'বাংলা প্রথম পত্র'),
    (r'বাংলা\s*[-–_]?\s*২য়|bangla\s*2nd|বাংলা\s*২য়\s*পত্র|বাংলা\s*২য়|বাংলা\s*২য়\s*পত্র|বাংলা\s*[-–_]?\s*২য়', 'বাংলা দ্বিতীয় পত্র'),

    # English 1st & 2nd
    (r'ইংরেজি\s*[-–_]?\s*১ম|ইংরেজী\s*[-–_]?\s*১ম|english\s*1st|ইংরেজি\s*১ম\s*পত্র|ইংরেজি\s*১ম', 'ইংরেজি প্রথম পত্র'),
    (r'ইংরেজি\s*[-–_]?\s*২য়|ইংরেজী\s*[-–_]?\s*২য়|english\s*2nd|ইংরেজি\s*২য়\s*পত্র|ইংরেজি\s*২য়|ইংরেজি\s*২য়\s*পত্র|ইংরেজি\s*দ্বি.*পত্র|ইংরেজী-২য়', 'ইংরেজি দ্বিতীয় পত্র'),
    (r'ইংরেজী', 'ইংরেজি'),

    # Science & Core
    (r'উচ্চতর\s*গণিত|উচ্চতর\s*গনিত|higher\s*math', 'উচ্চতর গণিত'),
    (r'পদার্থবিজ্ঞান|পদার্থ\s*বিজ্ঞান|পদার্থ/ইতিহাস/ব্যবসায়\s*উদ্যোগ|পদার্থ$', 'পদার্থবিজ্ঞান'),
    (r'জীববিজ্ঞান|জীব\s*বিজ্ঞান|biology', 'জীববিজ্ঞান'),
    (r'রসায়ন|রসায়ন', 'রসায়ন'),

    # Social & Humanities
    (r'বাংলাদেশের\s*ইতিহাস\s*ও\s*বিশ্বসভ্যতা|বা\s*ইতিহাস\s*ও\s*বিশ্বসভ্যতা|ইতিহাস$', 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা'),
    (r'বাংলাদেশ\s*ও\s*বিশ্বপরিচয|বাংলাদেশ\s*ও\s*বিশ্বপরিচয়|বাংলাদেশ\s*ও\s*বিশ্বপরিচয়|সমাজ|bgs', 'বাংলাদেশ ও বিশ্বপরিচয়'),
    (r'তথ্য\s*ও\s*যোগাযোগ\s*প্রযুক্ত|তথ্য\s*ও\s*যোগাযোগ\s*প্রযুক্তি|আইসিটি|ict', 'তথ্য ও যোগাযোগ প্রযুক্তি'),
    (r'হিন্দু\s*ধর্ম|হিন্দুধর্ম\s*ও\s*নৈতিক\s*শিক্ষা|hindu\s*moral\s*education', 'হিন্দুধর্ম ও নৈতিক শিক্ষা'),

    # Commerce & Economics
    (r'হিসাববিজ্ঞান|হিসাব\s*বিজ্ঞান|accounting', 'হিসাববিজ্ঞান'),
    (r'ব্যবসায়\s*উদ্যোগ|ব্যবসায়\s*উদ্যোগ|ব্যবসা\s*উদ্যোগ|ব্যবসায়\s*শিক্ষা|business\s*entrepreneurship', 'ব্যবসায় উদ্যোগ'),
    (r'ফিন্যান্স\s*ও\s*ব্যাংকিং|ব্যাংকিং\s*ও\s*ফিন্যান্স|finance', 'ফিন্যান্স ও ব্যাংকিং'),
    (r'ভূগোল\s*ও\s*পরিবেশ|ভূগোল|ভুগোল|geography', 'ভূগোল ও পরিবেশ'),
    (r'পৌরনীতি\s*ও\s*নাগরিকতা|পৌরনীতি\s*ও\s*নাগরিকতা|পৌরণীতি\s*ও\s*নাগরিকতা|পৌরনীতি/অর্থনীতি|পৌরনীতি$|civics', 'পৌরনীতি ও নাগরিকতা'),
    (r'পৌরনীতি\s*ও\s*সুশাসন', 'পৌরনীতি ও সুশাসন'),
    (r'চারু\s*ও\s*কারুকলা', 'শিল্প ও সংস্কৃতি'),
    (r'কৃষি\s*শিক্ষা|কৃষি\s*শিক্ষক|কৃষি|agriculture', 'কৃষি শিক্ষা'),
    (r'গার্হস্থ্য\s*বিজ্ঞান|গার্হস্থ্য|home\s*science', 'গার্হস্থ্য বিজ্ঞান'),
    (r'গণিত|গনিত|math|mathematics', 'গণিত'),
    (r'প্রাথমিক\s*বিজ্ঞান', 'প্রাথমিক বিজ্ঞান'),
    (r'বিজ্ঞান|science', 'বিজ্ঞান'),
    (r'অঙ্কন|অংকন|drawing', 'চিত্রাঙ্কন'),
    (r'কুরআন|কোরআন', 'কোরআন ও তাজবীদ'),
    (r'হাদিস|হাদীস', 'হাদিস ও উসূলুল হাদিস'),
    (r'আকাইদ', 'আকাইদ ও ফিকাহ'),
]

def normalize_subject_name(name):
    if not name:
        return name
    n = clean_str(name)
    if is_preserved_subject(n):
        return n
    if n in EXACT_CANONICAL_MAP:
        return EXACT_CANONICAL_MAP[n]
    for pattern, std_name in NORMALIZATION_PATTERNS:
        if re.search(pattern, n, re.IGNORECASE):
            return clean_str(std_name)
    return n

def get_standard_subjects_for_classroom(class_name):
    c_lower = clean_str(class_name).lower()

    # Pre-Primary / Lower Primary
    if any(k in c_lower for k in ['প্লে', 'play', 'নুরানী', 'নাযেরা', 'হিফজ', 'নাসারী', 'nursery', 'শিশু', 'shishu']):
        return ['বাংলা', 'ইংরেজি', 'গণিত', 'চিত্রাঙ্কন']

    # Primary 1st & 2nd
    if any(k in c_lower for k in ['প্রথম', '১ম', '1st', 'class 1', 'два', '২য়', '2nd', 'class 2']):
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
            'বাংলা প্রথম পত্র', 'বাংলা দ্বিতীয় পত্র', 'ইংরেজি প্রথম পত্র', 'ইংরেজি দ্বিতীয় পত্র',
            'গণিত', 'তথ্য ও যোগাযোগ প্রযুক্তি', 'ইসলাম ও নৈতিক শিক্ষা', 'বাংলাদেশ ও বিশ্বপরিচয়', 'বিজ্ঞান',
            'পদার্থবিজ্ঞান', 'রসায়ন', 'জীববিজ্ঞান', 'উচ্চতর গণিত',
            'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা', 'ভূগোল ও পরিবেশ', 'পৌরনীতি ও নাগরিকতা', 'অর্থনীতি',
            'হিসাববিজ্ঞান', 'ব্যবসায় উদ্যোগ', 'ফিন্যান্স ও ব্যাংকিং',
            'কৃষি শিক্ষা', 'গার্হস্থ্য বিজ্ঞান'
        ]

    # Higher Secondary 11, 12, HSC, Alim
    if any(k in c_lower for k in ['একাদশ', '১১শ', '11th', 'class 11', 'দ্বাদশ', '১২th', 'class 12', 'hsc', 'এইচএসসি', 'আলিম', 'আলীম']):
        return [
            'বাংলা প্রথম পত্র', 'বাংলা দ্বিতীয় পত্র', 'ইংরেজি প্রথম পত্র', 'ইংরেজি দ্বিতীয় পত্র', 'তথ্য ও যোগাযোগ প্রযুক্তি',
            'পদার্থবিজ্ঞান প্রথম পত্র', 'পদার্থবিজ্ঞান দ্বিতীয় পত্র', 'রসায়ন প্রথম পত্র', 'রসায়ন দ্বিতীয় পত্র',
            'জীববিজ্ঞান প্রথম পত্র', 'জীববিজ্ঞান দ্বিতীয় পত্র', 'উচ্চতর গণিত প্রথম পত্র', 'উচ্চতর গণিত দ্বিতীয় পত্র',
            'হিসাববিজ্ঞান প্রথম পত্র', 'হিসাববিজ্ঞান দ্বিতীয় পত্র', 'ব্যবসায় সংগঠন ও ব্যবস্থাপনা প্রথম পত্র', 'ব্যবসায় সংগঠন ও ব্যবস্থাপনা দ্বিতীয় পত্র',
            'অর্থনীতি প্রথম পত্র', 'অর্থনীতি দ্বিতীয় পত্র', 'পৌরনীতি ও সুশাসন প্রথম পত্র', 'পৌরনীতি ও সুশাসন দ্বিতীয় পত্র'
        ]

    # Default fallback
    return ['বাংলা', 'ইংরেজি', 'গণিত', 'বিজ্ঞান', 'তথ্য ও যোগাযোগ প্রযুক্তি', 'ইসলাম ও নৈতিক শিক্ষা']

def batch_relink_subject(old_subj_id, new_subj_id):
    if old_subj_id == new_subj_id:
        return 0

    rel_count = 0

    # 1. TeacherAssignment
    t_old = list(TeacherAssignment.objects.filter(subject_id=old_subj_id))
    if t_old:
        for t in t_old:
            if TeacherAssignment.objects.filter(teacher_id=t.teacher_id, subject_id=new_subj_id, classroom_id=t.classroom_id, section_id=t.section_id).exclude(id=t.id).exists():
                t.delete()
            else:
                TeacherAssignment.objects.filter(id=t.id).update(subject_id=new_subj_id)
            rel_count += 1

    # 2. Result
    res_old = Result.objects.filter(subject_id=old_subj_id)
    if res_old.exists():
        conflicting_pairs = set(Result.objects.filter(subject_id=new_subj_id).values_list('examination_id', 'student_id'))

        to_delete_ids = []
        for r in res_old.only('id', 'examination_id', 'student_id'):
            if (r.examination_id, r.student_id) in conflicting_pairs:
                to_delete_ids.append(r.id)

        if to_delete_ids:
            Result.objects.filter(id__in=to_delete_ids).delete()

        rel_count += res_old.count()
        res_old.update(subject_id=new_subj_id)

    # 3. ExamSlot
    e_qs = ExamSlot.objects.filter(subject_id=old_subj_id)
    rel_count += e_qs.count()
    e_qs.update(subject_id=new_subj_id)

    # 4. StudentProfile optional_subject
    s_qs = StudentProfile.objects.filter(optional_subject_id=old_subj_id)
    rel_count += s_qs.count()
    s_qs.update(optional_subject_id=new_subj_id)

    # 5. VirtualClass
    v_qs = VirtualClass.objects.filter(subject_id=old_subj_id)
    rel_count += v_qs.count()
    v_qs.update(subject_id=new_subj_id)

    # 6. Profiles
    for PModel in [Profile, AdminProfile, ParentProfile, CommitteeProfile]:
        p_qs = PModel.objects.filter(assigned_subject_id=old_subj_id)
        rel_count += p_qs.count()
        p_qs.update(assigned_subject_id=new_subj_id)

    return rel_count

def execute_subject_cleanup():
    print("=== EXECUTING CLEAN CANONICAL STANDARDIZATION ===")

    total_subjects_created = 0
    total_subjects_deleted = 0
    total_references_relinked = 0
    total_custom_preserved = 0

    schools = list(School.objects.all().order_by('id'))

    with transaction.atomic():
        for school in schools:
            classrooms = list(ClassRoom.objects.filter(school=school).prefetch_related('sections'))

            # Cache existing subjects for this school
            school_subjs = {clean_str(s.name).lower(): s for s in Subject.objects.filter(school=school)}

            # Step 1: Ensure standard board subjects exist per classroom & section
            for classroom in classrooms:
                std_names = get_standard_subjects_for_classroom(classroom.name)
                secs = list(classroom.sections.all())

                for sname in std_names:
                    cleaned_sname = clean_str(sname)
                    key = cleaned_sname.lower()

                    if key in school_subjs:
                        subj = school_subjs[key]
                    else:
                        subj = Subject.objects.create(school=school, name=cleaned_sname)
                        school_subjs[key] = subj
                        total_subjects_created += 1

                    subj.classrooms.add(classroom)
                    if secs:
                        subj.sections.add(*secs)

            # Step 2: Merge remaining variant names
            all_school_subjs = list(Subject.objects.filter(school=school))

            for old_subj in all_school_subjs:
                raw_name = clean_str(old_subj.name)

                if is_preserved_subject(raw_name):
                    total_custom_preserved += 1
                    continue

                std_name = normalize_subject_name(raw_name)
                target_key = clean_str(std_name).lower()

                if target_key in school_subjs:
                    target_subj = school_subjs[target_key]
                else:
                    target_subj = Subject.objects.create(school=school, name=clean_str(std_name))
                    school_subjs[target_key] = target_subj
                    total_subjects_created += 1

                if old_subj.id != target_subj.id:
                    relinked = batch_relink_subject(old_subj.id, target_subj.id)
                    total_references_relinked += relinked

                    old_subj.delete()
                    total_subjects_deleted += 1

        # Step 3: Remove orphaned subjects (subjects with no classrooms/sections and not preserved)
        orphaned = list(Subject.objects.filter(classrooms__isnull=True, sections__isnull=True))
        for orphan in orphaned:
            raw_name = clean_str(orphan.name)
            if is_preserved_subject(raw_name):
                continue

            std_name = normalize_subject_name(raw_name)
            target_subj = Subject.objects.filter(school=orphan.school, name__iexact=clean_str(std_name)).exclude(id=orphan.id).first()
            if target_subj:
                relinked = batch_relink_subject(orphan.id, target_subj.id)
                total_references_relinked += relinked
                orphan.delete()
                total_subjects_deleted += 1
            else:
                if not Result.objects.filter(subject_id=orphan.id).exists() and not TeacherAssignment.objects.filter(subject_id=orphan.id).exists():
                    orphan.delete()
                    total_subjects_deleted += 1

    print("\n=== FINAL CLEANUP COMPLETED ===")
    print(f"Total New Standard Subjects Created: {total_subjects_created}")
    print(f"Total Old/Messy/Orphaned Subjects Deleted: {total_subjects_deleted}")
    print(f"Total References Re-linked: {total_references_relinked}")
    print(f"Total Preserved Custom Subjects (আরবি/বই পড়া/Word Collection): {total_custom_preserved}")

if __name__ == '__main__':
    execute_subject_cleanup()
