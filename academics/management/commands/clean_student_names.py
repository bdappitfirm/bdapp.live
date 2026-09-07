from django.core.management.base import BaseCommand
from academics.models import StudentProfile
import re
import unicodedata

def normalize_bangla_base(word):
    if not word:
        return ''
    n = unicodedata.normalize('NFKC', str(word)).lower().strip()
    n = re.sub(r'[\u09cd\u0981-\u0983\u09bc-\u09d7]', '', n)
    n = n.replace('শ', 'স').replace('ষ', 'স')
    if 'চক্রব' in n or 'চক্রবর্ত' in n or 'চক্রবত' in n:
        return 'চক্রবর্তী'
    return n

def clean_student_name(fn, ln=''):
    fn = (fn or '').strip()
    ln = (ln or '').strip()

    # If fn has Bangla characters, strip trailing pure English words (e.g. Pradhania, Bakaul, Ahmed, Islam)
    if re.search(r'[\u0980-\u09ff]', fn):
        words = re.split(r'\s+', fn)
        last_bangla_idx = -1
        for i, w in enumerate(words):
            if re.search(r'[\u0980-\u09ff]', w):
                last_bangla_idx = i
        if last_bangla_idx != -1:
            fn = ' '.join(words[:last_bangla_idx + 1])

    is_english = lambda s: bool(re.match(r'^[a-zA-Z\s.]+$', s))
    if is_english(ln) and not is_english(fn):
        ln = ''

    combined = f"{fn} {ln}".strip()
    if not combined:
        return ''

    words = re.split(r'\s+', combined)
    result = []
    seen_bases = set()

    for word in words:
        w_clean = word.strip()
        if not w_clean:
            continue
        base = normalize_bangla_base(w_clean)
        if base and base not in seen_bases:
            seen_bases.add(base)
            result.append(w_clean)
        elif not base and w_clean.lower() not in seen_bases:
            seen_bases.add(w_clean.lower())
            result.append(w_clean)

    return ' '.join(result)

class Command(BaseCommand):
    help = 'Clean up student names by merging first and last names and removing duplicate/designation/trailing English surname parts.'

    def handle(self, *args, **options):
        self.stdout.write('Starting student name cleanup...')
        students = StudentProfile.objects.select_related('user').all()
        self.stdout.write(f'Found {students.count()} student profiles.')

        count = 0
        for student in students:
            user = student.user
            if user:
                fn = user.first_name or ''
                ln = user.last_name or ''
                ln_en = user.last_name_en or ''

                updated = False
                if ln or fn:
                    new_name = clean_student_name(fn, ln)
                    if user.first_name != new_name:
                        user.first_name = new_name
                        updated = True
                    if user.last_name != '':
                        user.last_name = ''
                        updated = True

                if ln_en and user.first_name.lower().endswith(ln_en.lower()):
                    user.last_name_en = ''
                    updated = True

                if updated:
                    user.save(update_fields=['first_name', 'last_name', 'last_name_en'])
                    count += 1

        self.stdout.write(self.style.SUCCESS(f'Successfully cleaned up {count} student names!'))
