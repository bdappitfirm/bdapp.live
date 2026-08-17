
from decimal import Decimal
import re

def _round_half_up(x):
    """Rounds a number to the nearest integer, with .5 rounding up."""
    if x is None:
        return 0
    d = Decimal(str(x))
    q = d.quantize(Decimal('1'), rounding='ROUND_HALF_UP')
    return int(q)

def _class_group(n):
    """Determines the class group (six_to_eight or nine_ten) based on class name."""
    x = (n or "").lower().strip()
    if not x:
        return None
        
    # Six to Eight
    if any(k in x for k in ["ষষ্ঠ", "six", " 6", "সপ্তম", "seven", " 7", "অষ্টম", "eight", " 8"]):
        if x.startswith("6") or x.startswith("7") or x.startswith("8"):
             return "six_to_eight"
        return "six_to_eight"
    
    # Nine to Ten (and SSC)
    if any(k in x for k in ["নবম", "nine", " 9", "দশম", "ten", " 10", "এসএসসি", "ssc"]):
        if x.startswith("9") or x.startswith("10"):
            return "nine_ten"
        return "nine_ten"
        
    return None

# Standard distributions
DIST_100_NO_PRACTICAL = {"written": 100, "mcq": 0, "practical": 0}
DIST_70_30 = {"written": 70, "mcq": 30, "practical": 0}
DIST_50_25_25 = {"written": 50, "mcq": 25, "practical": 25}
DIST_ICT_50 = {"written": 10, "mcq": 15, "practical": 25} # As per previous user request

SECTION_MAXIMA = {
    "six_to_eight": {
        # Bangla
        "bangla first paper": DIST_70_30,
        "বাংলা প্রথম পত্র": DIST_70_30,
        "বাংলা-১ম": DIST_70_30,
        "bangla second paper": {"written": 35, "mcq": 15, "practical": 0}, # Total 50
        "বাংলা দ্বিতীয় পত্র": {"written": 35, "mcq": 15, "practical": 0},
        "বাংলা-২য়": {"written": 35, "mcq": 15, "practical": 0},
        
        # English
        "english first paper": DIST_100_NO_PRACTICAL,
        "ইংরেজি প্রথম পত্র": DIST_100_NO_PRACTICAL,
        "ইংরেজী-১ম": DIST_100_NO_PRACTICAL,
        "ইংরেজি-১ম": DIST_100_NO_PRACTICAL,
        "ইংরেজি ১ম": DIST_100_NO_PRACTICAL,
        "ইংরেজী ১ম": DIST_100_NO_PRACTICAL,
        "ইংরেজি-১ম পত্র": DIST_100_NO_PRACTICAL,
        "ইংরেজী-১ম পত্র": DIST_100_NO_PRACTICAL,
        "english second paper": {"written": 50, "mcq": 0, "practical": 0}, # Total 50
        "ইংরেজি দ্বিতীয় পত্র": {"written": 50, "mcq": 0, "practical": 0},
        "ইংরেজী-২য়": {"written": 50, "mcq": 0, "practical": 0},
        "ইংরেজি-২য়": {"written": 50, "mcq": 0, "practical": 0},
        "ইংরেজি ২য়": {"written": 50, "mcq": 0, "practical": 0},
        "ইংরেজী ২য়": {"written": 50, "mcq": 0, "practical": 0},
        "ইংরেজি ২য়": {"written": 50, "mcq": 0, "practical": 0},
        "ইংরেজী ২য়": {"written": 50, "mcq": 0, "practical": 0},
        "ইংরেজি-২য় পত্র": {"written": 50, "mcq": 0, "practical": 0},
        "ইংরেজী-২য় পত্র": {"written": 50, "mcq": 0, "practical": 0},
        "ইংরেজি ২য় পত্র": {"written": 50, "mcq": 0, "practical": 0},
        "ইংরেজি ২য় পত্র": {"written": 50, "mcq": 0, "practical": 0},
        "ইংরেজী ২য় পত্র": {"written": 50, "mcq": 0, "practical": 0},

        # Math
        "mathematics": DIST_70_30,
        "গণিত": DIST_70_30,
        "সাধারণ গণিত": DIST_70_30,
        
        # Science
        "science": DIST_70_30,
        "বিজ্ঞান": DIST_70_30,
        
        # BGS
        "bangladesh and global studies": DIST_70_30,
        "বাংলাদেশ ও বিশ্বপরিচয়": DIST_70_30,
        "বাংলাদেশ ও বিশ্বপরিয়": DIST_70_30,
        "সমাজ": DIST_70_30,
        "social science": DIST_70_30,
        
        # Religion
        "religion": DIST_70_30,
        "ধর্ম": DIST_70_30,
        "ধর্ম ও নৈতিক শিক্ষা": DIST_70_30,
        "ইসলাম ও নৈতিক শিক্ষা": DIST_70_30,
        "hindu religion": DIST_70_30,
        "হিন্দু ধর্ম": DIST_70_30,
        
        # ICT
        "ict": DIST_ICT_50,
        "আইসিটি": DIST_ICT_50,
        "তথ্য ও যোগাযোগ প্রযুক্তি": DIST_ICT_50,
        
        # Agriculture / Home Economics
        "agriculture": {"written": 35, "mcq": 15, "practical": 0}, # Total 50 as per JSC standard
        "কৃষি": {"written": 35, "mcq": 15, "practical": 0},
        "কৃষি শিক্ষা": {"written": 35, "mcq": 15, "practical": 0},
        "home economics": {"written": 35, "mcq": 15, "practical": 0},
        "গার্হস্থ্য": {"written": 35, "mcq": 15, "practical": 0},
        
        # Arts and Crafts
        "arts and crafts": {"written": 50, "mcq": 0, "practical": 0}, # Assumption
        "চারু ও কারুকলা": {"written": 50, "mcq": 0, "practical": 0},
        
        # Physical Education
        "physical education": {"written": 0, "mcq": 0, "practical": 50},
        "শারীরিক শিক্ষা": {"written": 0, "mcq": 0, "practical": 50},
        "শারীরিক শিক্ষা ও স্বাস্থ্য": {"written": 0, "mcq": 0, "practical": 50},

        # Book Reading / Continuous Assessment
        "book reading": {"written": 50, "mcq": 0, "practical": 0},
        "বই পড়া": {"written": 50, "mcq": 0, "practical": 0},
        "বই পড়া": {"written": 50, "mcq": 0, "practical": 0},
        "word achievement": {"written": 50, "mcq": 0, "practical": 0},
        "word collection": {"written": 50, "mcq": 0, "practical": 0},
        "wcat": {"written": 50, "mcq": 0, "practical": 0},
    },
    "nine_ten": {
        # Bangla
        "bangla 1st paper": DIST_70_30,
        "বাংলা প্রথম পত্র": DIST_70_30,
        "বাংলা-১ম": DIST_70_30,
        "বাংলা ১ম": DIST_70_30,
        "bangla 2nd paper": DIST_70_30, # Corrected to 70/30 as per standard boards
        "বাংলা দ্বিতীয় পত্র": DIST_70_30,
        "বাংলা-২য়": DIST_70_30,
        "বাংলা ২য়": DIST_70_30,
        "বাংলা ২য়": DIST_70_30,
        "bangla 1+2": {"written": 140, "mcq": 60, "practical": 0}, # Combined
        "বাংলা ১+২": {"written": 140, "mcq": 60, "practical": 0},
        
        # English
        "english 1st paper": DIST_100_NO_PRACTICAL,
        "ইংরেজি প্রথম পত্র": DIST_100_NO_PRACTICAL,
        "ইংরেজী-১ম": DIST_100_NO_PRACTICAL,
        "ইংরেজি-১ম": DIST_100_NO_PRACTICAL,
        "ইংরেজি ১ম": DIST_100_NO_PRACTICAL,
        "ইংরেজী ১ম": DIST_100_NO_PRACTICAL,
        "english 2nd paper": DIST_100_NO_PRACTICAL,
        "ইংরেজি দ্বিতীয় পত্র": DIST_100_NO_PRACTICAL,
        "ইংরেজী-২য়": DIST_100_NO_PRACTICAL,
        "ইংরেজি-২য়": DIST_100_NO_PRACTICAL,
        "ইংরেজি ২য়": DIST_100_NO_PRACTICAL,
        "ইংরেজী ২য়": DIST_100_NO_PRACTICAL,
        "ইংরেজি ২য়": DIST_100_NO_PRACTICAL,
        "ইংরেজী ২য়": DIST_100_NO_PRACTICAL,
        "english 1+2": {"written": 200, "mcq": 0, "practical": 0}, # Combined
        "ইংরেজি ১+২": {"written": 200, "mcq": 0, "practical": 0},
        
        # Math
        "mathematics": DIST_70_30,
        "গণিত": DIST_70_30,
        "সাধারণ গণিত": DIST_70_30,
        "higher mathematics": DIST_50_25_25,
        "higher math": DIST_50_25_25,
        "উচ্চতর গণিত": DIST_50_25_25,
        
        # Science Group
        "physics": DIST_50_25_25,
        "পদার্থ": DIST_50_25_25,
        "পদার্থবিজ্ঞান": DIST_50_25_25,
        "chemistry": DIST_50_25_25,
        "রসায়ন": DIST_50_25_25,
        "রসায়ন": DIST_50_25_25,
        "biology": DIST_50_25_25,
        "জীববিজ্ঞান": DIST_50_25_25,
        
        # Humanities Group
        "history": DIST_70_30,
        "ইতিহাস": DIST_70_30,
        "বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা": DIST_70_30,
        "geography": DIST_70_30,
        "ভূগোল": DIST_70_30,
        "ভূগোল ও পরিবেশ": DIST_70_30,
        "civics": DIST_70_30,
        "পৌরনীতি": DIST_70_30,
        "পৌরনীতি ও নাগরিকতা": DIST_70_30,
        "economics": DIST_70_30,
        "অর্থনীতি": DIST_70_30,
        "bangladesh and global studies": DIST_70_30,
        "বাংলাদেশ ও বিশ্বপরিচয়": DIST_70_30,
        "বাংলাদেশ ও বিশ্বপরিচয়": DIST_70_30,
        "বাংলাদেশ ও বিশ্বপরিয়": DIST_70_30,
        
        # Business Group
        "accounting": DIST_70_30,
        "হিসাববিজ্ঞান": DIST_70_30,
        "finance": DIST_70_30,
        "ফিন্যান্স": DIST_70_30,
        "ফিন্যান্স ও ব্যাংকিং": DIST_70_30,
        "business entrepreneurship": DIST_70_30,
        "ব্যবসায় উদ্যোগ": DIST_70_30,
        "business studies": DIST_70_30, # Generic
        "ব্যবসায় শিক্ষা": DIST_70_30,
        
        # Common
        "science": DIST_70_30,
        "বিজ্ঞান": DIST_70_30,
        "ict": {"written": 0, "mcq": 25, "practical": 25},
        "আইসিটি": {"written": 0, "mcq": 25, "practical": 25},
        "তথ্য ও যোগাযোগ প্রযুক্তি": {"written": 0, "mcq": 25, "practical": 25},
        
        "religion": DIST_70_30,
        "ধর্ম": DIST_70_30,
        "ধর্ম ও নৈতিক শিক্ষা": DIST_70_30,
        "ইসলাম ও নৈতিক শিক্ষা": DIST_70_30,
        "hindu religion": DIST_70_30,
        "হিন্দু ধর্ম": DIST_70_30,
        
        "agriculture": DIST_50_25_25,
        "কৃষি": DIST_50_25_25,
        "কৃষি শিক্ষা": DIST_50_25_25,
        
        "career education": {"written": 0, "mcq": 0, "practical": 100},
        "ক্যারিয়ার শিক্ষা": {"written": 0, "mcq": 0, "practical": 100},
        "book reading": {"written": 0, "mcq": 0, "practical": 100},
        "বই পড়া": {"written": 0, "mcq": 0, "practical": 100},
        "word achievement": {"written": 0, "mcq": 0, "practical": 100},
        "wcat": {"written": 0, "mcq": 0, "practical": 100},

        "গার্হস্থ্য বিজ্ঞান": DIST_50_25_25,
        "home economics": DIST_50_25_25,

        "physical education": {"written": 0, "mcq": 0, "practical": 100},
        "শারীরিক শিক্ষা": {"written": 0, "mcq": 0, "practical": 100},
        "শারীরিক শিক্ষা ও স্বাস্থ্য": {"written": 0, "mcq": 0, "practical": 100},
    }
}

def get_subject_maxima(group, subject_name):
    """
    Returns the maxima dictionary for a given subject in a class group.
    Enhanced with priority matching for 2nd papers to ensure correct divisors.
    """
    if not group:
        return None
    raw = (subject_name or "").strip().lower()
    # Remove contents inside parentheses
    s = re.sub(r"\s*\(.*?\)\s*", "", raw).strip()
    # Normalize spaces and punctuation
    s = re.sub(r"[-_.,]", " ", s).strip()
    s = " ".join(s.split())

    group_maxima = SECTION_MAXIMA.get(group, {})
    
    # 1. Exact match
    if s in group_maxima:
        return group_maxima[s]

    # 2. Priority: Check for 2nd papers or specific complex names
    if any(k in s for k in ["2nd", "second", "২য়", "২য়"]):
        if "bangla" in s or "বাংলা" in s:
            target = "bangla second paper"
            if target in group_maxima: return group_maxima[target]
        if "english" in s or "english" in s or "ইংরেজি" in s or "ইংরেজী" in s:
            target = "english second paper"
            if target in group_maxima: return group_maxima[target]

    # Priority 2: Check for Agriculture/Home Economics (to avoid partial match with 'Science/বিজ্ঞান')
    if any(k in s for k in ["কৃষি", "গার্হস্থ্য", "agri", "home ec"]):
        if "কৃষি" in s or "agri" in s:
            return group_maxima.get("কৃষি") or group_maxima.get("agriculture")
        if "গার্হস্থ্য" in s or "home" in s:
            return group_maxima.get("গার্হস্থ্য") or group_maxima.get("home economics")

    # 3. Check for Paper 1
    if any(k in s for k in ["1st", "first", "১ম"]):
        if "bangla" in s or "বাংলা" in s:
            target = "bangla first paper"
            if target in group_maxima: return group_maxima[target]
        if "english" in s or "english" in s or "ইংরেজি" in s or "ইংরেজী" in s:
            target = "english first paper"
            if target in group_maxima: return group_maxima[target]

    # 4. Check for general keywords
    keywords_map = {
        'bangla': 'bangla first paper',
        'বাংলা': 'বাংলা প্রথম পত্র',
        'english': 'english first paper',
        'ইংরেজি': 'ইংরেজি প্রথম পত্র',
        'math': 'mathematics',
        'গণিত': 'গণিত',
        'science': 'science',
        'বিজ্ঞান': 'বিজ্ঞান',
        'religion': 'religion',
        'ধর্ম': 'ধর্ম',
        'ict': 'ict',
        'তথ্য': 'তথ্য ও যোগাযোগ প্রযুক্তি',
        'কৃষি': 'কৃষি',
        'গার্হস্থ্য': 'গার্হস্থ্য',
        'agriculture': 'agriculture',
        'home economics': 'home economics',
        'book reading': 'book reading',
        'word achievement': 'word achievement',
        'physical education': 'physical education'
    }

    for kw, target in keywords_map.items():
        if kw in s:
            if target in group_maxima:
                return group_maxima[target]

    # 5. Final fallback: check if any key in group_maxima is part of s or vice-versa
    for k, v in group_maxima.items():
        if k in s or s in k:
            return v
    
    return None
