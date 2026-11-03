import unicodedata
import re

BANGLA_CLASS_ORDER_PATTERNS = [
    (r'প্লে|play', 1),
    (r'নুরানী', 2),
    (r'নাযেরা|হিফজ', 3),
    (r'নাসারী|নার্সারি|nursery|শিশু|shishu', 4),
    (r'কেজি|kg', 5),
    (r'প্রথম|১ম|\b1st\b|class\s*1|\bone\b', 6),
    (r'দ্বিতীয়|দ্বিতীয়|২য়|\b2nd\b|class\s*2|\btwo\b', 7),
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
    (r'দ্বাদশ|১২থ|১২শ|\b12th\b|class\s*12|\btwelve\b', 19),
    (r'এইচএসসি|hsc|আলিম|আলীম', 20),
    (r'ফাজেল|কামেল|স্নাতক', 21),
]

def clean_str(val):
    if not val: return ''
    return unicodedata.normalize('NFKC', str(val)).strip()

def get_class_order(class_name):
    if not class_name:
        return (999, 0, '')

    n = clean_str(class_name).lower()
    is_2027 = 1 if ('2027' in n or '২০২৭' in n) else 0

    # Clean off year for matching
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

    return (base_rank, is_2027, base_n)

BANGLA_SECTION_MAP = {
    'ক': 1, 'খ': 2, 'গ': 3, 'ঘ': 4, 'ঙ': 5, 'চ': 6, 'ছ': 7, 'জ': 8,
    'বিজ্ঞান': 101,
    'মানবিক': 102,
    'ব্যবসায়': 103, 'ব্যবসায়': 103, 'ব্যবসায় শিক্ষা': 103, 'ব্যবসায় শিক্ষা': 103, 'ব্যবসায় শাখা': 103
}

def get_section_order(section_name):
    if not section_name:
        return 999
    s = clean_str(section_name)
    if s in BANGLA_SECTION_MAP:
        return BANGLA_SECTION_MAP[s]
    if len(s) == 1 and 'A' <= s.upper() <= 'Z':
        return 200 + ord(s.upper())
    match = re.search(r'\d+', s)
    if match:
        return 300 + int(match.group(0))
    return 999

# Test class order
test_classes = [
    'নবম শ্রেণি-২০২৭', 'নবম শ্রেণি', 'শিশু শ্রেণি', 'প্রথম শ্রেণি', 'তৃতীয় শ্রেণি-২০২৭', 'তৃতীয় শ্রেণি',
    'S.S.C.', 'S.S.C.-২০২৭', 'দশম শ্রেণি', 'দশম শ্রেণি-২০২৭', 'প্লে', 'প্লে-২০২৭'
]
sorted_classes = sorted(test_classes, key=get_class_order)
print("Sorted Classes Test:")
for c in sorted_classes:
    print("  -", c)

# Test section order
test_sections = ['গ', 'ক', 'মানবিক', 'বিজ্ঞান', 'খ', 'ব্যবসায়']
sorted_sections = sorted(test_sections, key=get_section_order)
print("\nSorted Sections Test:")
for s in sorted_sections:
    print("  -", s)
