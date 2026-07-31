import re
from django.core.management.base import BaseCommand
from django.db import models
from users.models import User, Profile
from academics.models import StudentProfile

def transliterate_bangla(text):
    """
    A simple rule-based transliterator for Bangla to English phonetic spelling.
    Handles consonants, vowels, and common name patterns.
    """
    if not text or not isinstance(text, str):
        return text

    # Check if text contains Bangla characters (U+0980 to U+09FF)
    if not any('\u0980' <= char <= '\u09FF' for char in text):
        return text

    # Mapping of Bangla characters to English phonetic equivalents
    mapping = {
        'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
        'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
        'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
        'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
        'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
        'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
        'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n',
        'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri',
        'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
        'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri',
        'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
        '্': '', '্য': 'y', '্র': 'r', '্ব': 'b', '্ল': 'l'
    }

    # Special handling for common name suffixes and patterns
    text = text.replace('উদ্দীন', 'uddin').replace('ইসলাম', 'islam').replace('রহমান', 'rahman')
    text = text.replace('আহমেদ', 'ahmed').replace('খান', 'khan').replace('চৌধুরী', 'chowdhury')

    result = ""
    i = 0
    while i < len(text):
        char = text[i]
        if char in mapping:
            result += mapping[char]
        else:
            result += char
        i += 1

    result = re.sub(r'\s+', ' ', result).strip()
    return result.title()

class Command(BaseCommand):
    help = 'Transliterates profile data from Bangla to English phonetic spelling'

    def handle(self, *args, **options):
        self.stdout.write("--- Profile Transliteration Tool (Bangla to English Spelling) ---")

        # 1. User Names
        self.stdout.write("\n[1/3] Processing Users (Names)...")
        users_to_update = User.objects.filter(models.Q(first_name_en__isnull=True) | models.Q(first_name_en='') | models.Q(last_name_en__isnull=True) | models.Q(last_name_en=''))
        u_count = 0
        for user in users_to_update:
            updated = False
            if user.first_name and not user.first_name_en:
                user.first_name_en = transliterate_bangla(user.first_name)
                updated = True
            if user.last_name and not user.last_name_en:
                user.last_name_en = transliterate_bangla(user.last_name)
                updated = True

            if updated:
                user.save(update_fields=['first_name_en', 'last_name_en'])
                u_count += 1
                self.stdout.write(self.style.SUCCESS(f"  [+] User ({user.username}): {user.first_name} -> {user.first_name_en}"))

        # 2. Student Profile Fields
        self.stdout.write("\n[2/3] Processing Student Profiles (Parents & Address)...")
        students = StudentProfile.objects.all()
        s_count = 0
        for student in students:
            fields_to_update = []

            if student.guardian_name and not student.guardian_name_en:
                student.guardian_name_en = transliterate_bangla(student.guardian_name)
                fields_to_update.append('guardian_name_en')

            if student.father_name and not student.father_name_en:
                student.father_name_en = transliterate_bangla(student.father_name)
                fields_to_update.append('father_name_en')

            if student.mother_name and not student.mother_name_en:
                student.mother_name_en = transliterate_bangla(student.mother_name)
                fields_to_update.append('mother_name_en')

            if student.address and not student.address_en:
                student.address_en = transliterate_bangla(student.address)
                fields_to_update.append('address_en')

            if fields_to_update:
                student.save(update_fields=fields_to_update)
                s_count += 1
                self.stdout.write(f"  [+] Student ({student.user.username}) updated.")

        # 3. User Profile Fields
        self.stdout.write("\n[3/3] Processing User Profiles (Designation & Occupation)...")
        profiles = Profile.objects.all()
        p_count = 0
        for profile in profiles:
            fields_to_update = []
            if profile.designation and not profile.designation_en:
                profile.designation_en = transliterate_bangla(profile.designation)
                fields_to_update.append('designation_en')
            if profile.occupation and not profile.occupation_en:
                profile.occupation_en = transliterate_bangla(profile.occupation)
                fields_to_update.append('occupation_en')

            if fields_to_update:
                profile.save(update_fields=fields_to_update)
                p_count += 1
                self.stdout.write(f"  [+] Profile ({profile.user.username}) updated.")

        self.stdout.write("\n" + "="*40)
        self.stdout.write(f"Transliteration Summary:")
        self.stdout.write(f"  - Users Updated: {u_count}")
        self.stdout.write(f"  - Student Profiles Updated: {s_count}")
        self.stdout.write(f"  - Common Profiles Updated: {p_count}")
        self.stdout.write("="*40)
        self.stdout.write(self.style.SUCCESS("\nAll tasks completed successfully!"))
