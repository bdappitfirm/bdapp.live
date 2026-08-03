import os
import django
import sys
import re

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import User, Profile
from academics.models import StudentProfile

def transliterate_bangla(text):
    """
    Improved rule-based transliterator for Bangla to English phonetic spelling.
    Handles consonants, vowels, and common name patterns.
    """
    if not text or not isinstance(text, str):
        return text

    # Check if text contains Bangla characters
    if not any('\u0980' <= char <= '\u09FF' for char in text):
        return text

    # Mapping of Bangla characters to English phonetic equivalents
    mapping = {
        'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
        'চ': 'ch', 'ছ': 'sh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
        'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
        'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
        'প': 'p', 'ফ': 'p', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
        'য': 'z', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
        'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n',
        'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri',
        'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
        'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri',
        'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
        '্': '', '্য': 'y', '্র': 'r', '্ব': 'b', '্ল': 'l'
    }

    # Common titles and honorifics
    text = text.replace('মো: ', 'Md. ').replace('মোঃ ', 'Md. ')
    text = text.replace('মোসাম্মৎ', 'Mst.').replace('মোসা:', 'Mst.').replace('মোসাঃ', 'Mst.')

    # Special handling for common name suffixes and patterns
    text = text.replace('উদ্দীন', 'uddin').replace('ইসলাম', 'islam').replace('রহমান', 'rahman')
    text = text.replace('আহমেদ', 'ahmed').replace('খান', 'khan').replace('চৌধুরী', 'chowdhury')
    text = text.replace('বেগম', 'begum').replace('মন্ডল', 'mondal').replace('বিশ্বাস', 'biswas').replace('সরকার', 'sarkar')

    result = ""
    i = 0
    while i < len(text):
        char = text[i]
        if char in mapping:
            result += mapping[char]
        else:
            result += char
        i += 1

    # Cleanup and Casing
    words = re.sub(r'\s+', ' ', result).strip().split(' ')
    processed_words = []
    for word in words:
        if not word: continue
        lower_word = word.lower()
        if lower_word == 'md': processed_words.append('Md.')
        elif lower_word == 'mst': processed_words.append('Mst.')
        else: processed_words.append(word.capitalize())

    return ' '.join(processed_words)

def run_auto_translation(force=False):
    print(f"--- Profile Transliteration Tool (Bangla to English Spelling) --- {'[FORCE MODE]' if force else ''}")

    # 1. User Names
    print("\n[1/3] Processing Users (Names)...")
    if force:
        users_to_update = User.objects.exclude(first_name='')
    else:
        users_to_update = User.objects.filter(first_name_en__isnull=True) | User.objects.filter(first_name_en='')

    u_count = 0
    for user in users_to_update:
        updated = False
        if user.first_name and (force or not user.first_name_en):
            new_val = transliterate_bangla(user.first_name)
            if user.first_name_en != new_val:
                user.first_name_en = new_val
                updated = True
        if user.last_name and (force or not user.last_name_en):
            new_val = transliterate_bangla(user.last_name)
            if user.last_name_en != new_val:
                user.last_name_en = new_val
                updated = True

        if updated:
            user.save(update_fields=['first_name_en', 'last_name_en'])
            u_count += 1
            print(f"  [+] User ({user.username}): {user.first_name} -> {user.first_name_en}")

    # 2. Student Profile Fields
    print("\n[2/3] Processing Student Profiles (Parents & Address)...")
    students = StudentProfile.objects.all()
    s_count = 0
    for student in students:
        fields_to_update = []

        for field in ['guardian_name', 'father_name', 'mother_name', 'address']:
            val = getattr(student, field)
            en_field = f"{field}_en"
            en_val = getattr(student, en_field)

            if val and (force or not en_val):
                new_en_val = transliterate_bangla(val)
                if en_val != new_en_val:
                    setattr(student, en_field, new_en_val)
                    fields_to_update.append(en_field)

        if fields_to_update:
            student.save(update_fields=fields_to_update)
            s_count += 1
            print(f"  [+] Student ({student.user.username}) updated.")

    # 3. User Profile Fields
    print("\n[3/3] Processing User Profiles (Designation & Occupation)...")
    profiles = Profile.objects.all()
    p_count = 0
    for profile in profiles:
        fields_to_update = []
        if profile.designation and (force or not profile.designation_en):
            new_val = transliterate_bangla(profile.designation)
            if profile.designation_en != new_val:
                profile.designation_en = new_val
                fields_to_update.append('designation_en')
        if profile.occupation and (force or not profile.occupation_en):
            new_val = transliterate_bangla(profile.occupation)
            if profile.occupation_en != new_val:
                profile.occupation_en = new_val
                fields_to_update.append('occupation_en')

        if fields_to_update:
            profile.save(update_fields=fields_to_update)
            p_count += 1
            print(f"  [+] Profile ({profile.user.username}) updated.")

    print("\n" + "="*40)
    print(f"Transliteration Summary:")
    print(f"  - Users Updated: {u_count}")
    print(f"  - Student Profiles Updated: {s_count}")
    print(f"  - Common Profiles Updated: {p_count}")
    print("="*40)
    print("\nAll tasks completed successfully!")

if __name__ == "__main__":
    force_mode = "--force" in sys.argv
    run_auto_translation(force=force_mode)
