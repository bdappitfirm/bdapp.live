import re
from django.core.management.base import BaseCommand
from django.db import models
from users.models import User, Profile
from academics.models import StudentProfile
from schools.models import School

def transliterate_bangla(text):
    """
    Improved rule-based transliterator for Bangla to English phonetic spelling.
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
        '্': '', '্য': 'y', '্র': 'r', '্ব': 'b', '্ল': 'l',
        '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
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

class Command(BaseCommand):
    help = 'Transliterates profile data from Bangla to English phonetic spelling'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force re-translation of all profiles even if English name exists',
        )

    def handle(self, *args, **options):
        force = options.get('force', False)
        self.stdout.write(f"--- Profile Transliteration Tool (Bangla to English Spelling) --- {'[FORCE MODE]' if force else ''}")

        # 1. User Names
        self.stdout.write("\n[1/3] Processing Users (Names)...")
        if force:
            users_to_update = User.objects.exclude(first_name='')
        else:
            users_to_update = User.objects.filter(models.Q(first_name_en__isnull=True) | models.Q(first_name_en='') | models.Q(last_name_en__isnull=True) | models.Q(last_name_en=''))

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
                self.stdout.write(self.style.SUCCESS(f"  [+] User ({user.username}): {user.first_name} -> {user.first_name_en}"))

        # 2. Student Profile Fields
        self.stdout.write("\n[2/3] Processing Student Profiles (Parents & Address)...")
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
                self.stdout.write(f"  [+] Student ({student.user.username}) updated.")

        # 3. User Profile Fields
        self.stdout.write("\n[3/4] Processing User Profiles (Designation & Occupation)...")
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
                self.stdout.write(f"  [+] Profile ({profile.user.username}) updated.")

        # 4. School Fields
        self.stdout.write("\n[4/4] Processing School Headers...")
        schools = School.objects.all()
        sch_count = 0
        for school in schools:
            fields_to_update = []
            if school.name and not school.name_en:
                school.name_en = transliterate_bangla(school.name)
                fields_to_update.append('name_en')
            if school.address and not school.address_en:
                school.address_en = transliterate_bangla(school.address)
                fields_to_update.append('address_en')

            if fields_to_update:
                school.save(update_fields=fields_to_update)
                sch_count += 1
                self.stdout.write(self.style.SUCCESS(f"  [+] School ({school.id}) updated: {school.name_en}"))

        self.stdout.write("\n" + "="*40)
        self.stdout.write(f"Transliteration Summary:")
        self.stdout.write(f"  - Users Updated: {u_count}")
        self.stdout.write(f"  - Student Profiles Updated: {s_count}")
        self.stdout.write(f"  - Common Profiles Updated: {p_count}")
        self.stdout.write(f"  - Schools Updated: {sch_count}")
        self.stdout.write("="*40)
        self.stdout.write(self.style.SUCCESS("\nAll tasks completed successfully!"))
