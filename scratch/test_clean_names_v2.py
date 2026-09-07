import re
import unicodedata

def normalize_bangla_base(word):
    if not word:
        return ''
    n = unicodedata.normalize('NFKC', str(word)).lower().strip()
    # Remove vowel signs (kar)
    n = re.sub(r'[\u09be-\u09c4\u09c7-\u09d7\u09bc]', '', n)
    return n

def clean_student_name(fn, ln=''):
    combined = f"{fn or ''} {ln or ''}".strip()
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

print(clean_student_name("নুসরাত জাহান জুই জুঁই"))
print(clean_student_name("আইনুন নিশাত শাইফা সাইফা"))
print(clean_student_name("সুস্মিতা চক্রবর্তী চক্রবতী"))
