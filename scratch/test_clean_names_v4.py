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

    # If fn has Bangla characters, strip trailing pure English words
    if re.search(r'[\u0980-\u09ff]', fn):
        words = re.split(r'\s+', fn)
        last_bangla_idx = -1
        for i, w in enumerate(words):
            if re.search(r'[\u0980-\u09ff]', w):
                last_bangla_idx = i
        if last_bangla_idx != -1:
            fn = ' '.join(words[:last_bangla_idx + 1])

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

print("1:", clean_student_name("আবদুল্লা প্রধানীয়া Pradhania"))
print("2:", clean_student_name("মোঃ তানজিদ বকাউল Bakaul"))
print("3:", clean_student_name("ফয়েজ আহম্মেদ Ahmed"))
print("4:", clean_student_name("মহিন ইসলাম Islam"))
print("5:", clean_student_name("নুসরাত জাহান জুই জুঁই"))
