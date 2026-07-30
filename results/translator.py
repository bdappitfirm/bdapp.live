
import os
import json
import re
from django.conf import settings

# Comprehensive word replacement
WORD_MAP = {
    "ষষ্ঠ": "Sixth", "সপ্তম": "Seventh", "অষ্টম": "Eighth", "নবম": "Ninth", "দশম": "Tenth",
    "শ্রেণী": "Class", "শ্রেণি": "Class", "বিজ্ঞান": "Science", "মানবিক": "Humanities",
    "ব্যবসায় শিক্ষা": "Business Studies", "ব্যবসায় শিক্ষা": "Business Studies",
    "ব্যবসায়িক শিক্ষা": "Business Studies", "ব্যবসায়িক শিক্ষা": "Business Studies",
    "শাখা": "Section", "বার্ষিক": "Annual", "অর্ধ বার্ষিক": "Half Yearly", "অর্ধ-বার্ষিক": "Half Yearly",
    "প্রাক-নির্বাচনী": "Pre-Test", "নির্বাচনী": "Test Exam", "মডেল টেস্ট": "Model Test",
    "প্রথম": "1st", "দ্বিতীয়": "2nd", "দ্বিতীয়": "2nd", "পত্র": "Paper",
    "উচ্চ বিদ্যালয়": "High School", "উচ্চ বিদ্যালয়": "High School", "বিদ্যালয়": "School", "বিদ্যালয়": "School",
    "প্রাক নির্বাচনী": "Pre-Test", "পৌরসভা": "Municipality", "সদর": "Sadar", "ইউনিয়ন": "Union", "ইউনিয়ন": "Union",
    "(ক)": "(A)", "(খ)": "(B)", "(গ)": "(C)", "(ঘ)": "(D)", "নং": "No.",
    "চাঁদপুর": "Chandpur", "লক্ষ্মীপুর": "Lakshmipur", "কুমিল্লা": "Cumilla", "ঢাকা": "Dhaka",
    "কচুয়া": "Kachua", "রামগঞ্জ": "Ramganj", "মৈশাদী": "Moishadi", "ভাটরা": "Bhatra",
    "হাজী মহসিন রোড": "Haji Mohsin Road"
}

# Absolute subject mappings (Exact match prioritized)
FALLBACK_SUBJECTS = {
    "বাংলা": "Bengali", "বাংলা ১ম": "Bengali 1st", "বাংলা ২য়": "Bengali 2nd",
    "বাংলা প্রথম পত্র": "Bengali 1st Paper", "বাংলা দ্বিতীয় পত্র": "Bengali 2nd Paper",
    "ইংরেজি": "English", "ইংরেজি ১ম": "English 1st", "ইংরেজি ২য়": "English 2nd",
    "ইংরেজি প্রথম পত্র": "English 1st Paper", "ইংরেজি দ্বিতীয় পত্র": "English 2nd Paper",
    "গণিত": "Mathematics", "সাধারণ গণিত": "General Mathematics", "উচ্চতর গণিত": "Higher Mathematics",
    "বিজ্ঞান": "Science", "পদার্থ": "Physics", "পদার্থবিজ্ঞান": "Physics", "পদার্থ বিজ্ঞান": "Physics",
    "রসায়ন": "Chemistry", "রসায়ন": "Chemistry", "জীববিজ্ঞান": "Biology", "জীব বিজ্ঞান": "Biology",
    "তথ্য ও যোগাযোগ প্রযুক্তি": "ICT", "আইসিটি": "ICT", "ধর্ম": "Religion", "ইসলাম শিক্ষা": "Islam Education",
    "বাংলাদেশ ও বিশ্বপরিচয়": "BGS", "বাংলাদেশ ও বিশ্ব পরিচয়": "BGS", "ইতিহাস": "History",
    "ভূগোল": "Geography", "ভুগোল": "Geography", "পৌরনীতি": "Civics", "হিসাববিজ্ঞান": "Accounting",
    "ব্যবসায় উদ্যোগ": "Business Ent.", "কৃষি শিক্ষা": "Agriculture", "গার্হস্থ্য বিজ্ঞান": "Home Science",
    "কৃষি শিক্ষা/গার্হস্থ্য বিজ্ঞান": "Agriculture/Home Science",
    "বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা": "History", "পৌরনীতি ও নাগরিকতা": "Civics",
    "শারীরিক শিক্ষা": "Physical Education", "ক্যারিয়ার শিক্ষা": "Career Education",
    "চারু ও কারুকলা": "Arts & Crafts", "অঙ্কন": "Drawing"
}

def translate_to_english(data_dict):
    """
    Hybrid Translation with deep word replacement and subject mapping.
    """
    def dictionary_translate(text):
        if not text: return ""
        raw = str(text).strip()

        # 1. Subject direct match
        if raw in FALLBACK_SUBJECTS: return FALLBACK_SUBJECTS[raw]

        # 2. Part by part replacement for subjects and addresses
        translated = raw
        # Specific fix for common complex subject strings
        if "ইতিহাস" in translated: return "History"
        if "পৌরনীতি" in translated: return "Civics"
        if "কৃষি" in translated: return "Agriculture"

        # General word replacement
        sorted_keys = sorted(WORD_MAP.keys(), key=len, reverse=True)
        for bn in sorted_keys:
            translated = translated.replace(bn, WORD_MAP[bn])

        return translated

    results = {
        "school_name": dictionary_translate(data_dict.get("school_name")),
        "student_name": dictionary_translate(data_dict.get("student_name")),
        "father_name": dictionary_translate(data_dict.get("father_name")),
        "mother_name": dictionary_translate(data_dict.get("mother_name")),
        "guardian_name": dictionary_translate(data_dict.get("guardian_name")),
        "address": dictionary_translate(data_dict.get("address")),
        "class_name": dictionary_translate(data_dict.get("class_name")),
        "examination_name": dictionary_translate(data_dict.get("examination_name")),
        "subjects": {sub: dictionary_translate(sub) for sub in data_dict.get("subjects", [])}
    }

    # AI pass to clean up transliteration
    api_key = getattr(settings, 'GEMINI_API_KEY', None)
    if api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = f"Translate Bengali school JSON to standard English. No Bengali letters in output: {json.dumps(data_dict, ensure_ascii=False)}"
            response = model.generate_content(prompt)
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if json_match:
                ai_data = json.loads(json_match.group())
                for key in results:
                    val = ai_data.get(key)
                    if val and not any(ord(c) > 127 for c in str(val)):
                        if key == "subjects" and isinstance(val, dict):
                            for s_k, s_v in val.items(): results["subjects"][s_k] = s_v
                        else: results[key] = val
        except Exception: pass

    return results
