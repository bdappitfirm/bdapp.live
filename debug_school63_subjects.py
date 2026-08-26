"""
Diagnostic script for School 63 subject investigation.
Checks Subject records and simulates frontend normalizeSubjKey + getWeight logic.
"""
import os
import re
import sys
from collections import defaultdict

# Capture output to a file since terminal seems to lose stdout sometimes
out_lines = []
def pr(s=''):
    out_lines.append(str(s))
    # Also print for immediate debugging
    print(s, flush=True)

pr("Script started at: " + __import__('datetime').datetime.now().isoformat())
pr("PYTHONPATH: " + sys.path[0])

try:
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    pr("Django module imported OK")
    django.setup()
    pr("Django setup OK")
except Exception as e:
    pr(f"Django init FAILED: {type(e).__name__}: {e}")
    import traceback
    pr(traceback.format_exc())
    with open('debug_school63_output.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(out_lines))
    sys.exit(1)

from academics.models import Subject

# Simulate frontend normalizeSubjKey (Bangla-English aware)
def normalize_subj_key(n):
    low = str(n).lower().strip()
    low = re.sub(r'[\u200B-\u200D\uFEFF]', '', low)
    if 'higher' in low or 'উচ্চতর' in low: return 'higher'
    if 'math' in low or 'গণিত' in low or 'গনিত' in low: return 'math'
    if 'history' in low or 'ইতিহাস' in low or 'সভ্যতা' in low: return 'history'
    if 'bgs' in low or (('বাংলাদেশ' in low) and ('পরিচয়' in low or 'বিজিএস' in low)) or 'global studies' in low: return 'bgs'
    if ('bangla' in low or 'বাংলা' in low) and 'বাংলাদেশ' not in low and 'bangladesh' not in low: return 'bangla'
    if 'english' in low or 'ইংরেজি' in low or 'ইংরেজী' in low: return 'english'
    if 'religion' in low or 'islam' in low or 'hindu' in low or 'ধর্ম' in low or 'ইসলাম' in low or 'হিন্দু' in low or 'moral' in low or 'নৈতিক' in low: return 'religion'
    if 'ict' in low or 'তথ্য' in low or 'information' in low or 'communication' in low or 'technology' in low: return 'ict'
    if 'physics' in low or 'পদার্থ' in low: return 'physics'
    if 'chemistry' in low or 'রসায়ন' in low: return 'chemistry'
    if 'biology' in low or 'জীব' in low: return 'biology'
    if 'agriculture' in low or 'কৃষি' in low or 'home' in low or 'গার্হস্থ্য' in low: return 'agriculture'
    if 'accounting' in low or 'হিসাব' in low: return 'accounting'
    if 'finance' in low or 'ফিন্যান্স' in low: return 'finance'
    if 'business' in low or 'ব্যবসায়' in low or 'entrepreneurship' in low or 'উদ্যোগ' in low: return 'business'
    if 'geography' in low or 'ভূগোল' in low or 'ভুগোল' in low: return 'geography'
    if 'civics' in low or 'পৌরনীতি' in low or 'পৌরণীতি' in low: return 'civics'
    if 'economics' in low or 'অর্থনীতি' in low: return 'economics'
    if ('science' in low or 'বিজ্ঞান' in low) and 'social' not in low and 'সমাজ' not in low: return 'science'
    return low

# Simulate frontend getWeight (uses label, NOT key - THIS IS THE BUG)
def get_weight_by_label(name):
    n = name.lower()
    if ('bgs' in n or 'বাংলাদেশ' in n or 'global' in n or 'world' in n or 'বিশ্ব' in n or 'social' in n):
        if 'bangla' not in n and 'pure science' not in n: return 60
    if ('bangla' in n or 'বাংলা' in n) and 'বাংলাদেশ' not in n and 'bangladesh' not in n: return 11
    if 'english' in n or 'ইংরেজি' in n: return 21
    if 'math' in n or 'গণিত' in n or 'গনিত' in n: return 30
    if 'religion' in n or 'islam' in n or 'hindu' in n or 'ধর্ম' in n or 'ইসলাম' in n or 'হিন্দু' in n or 'moral' in n: return 40
    if 'ict' in n or 'তথ্য' in n: return 50
    if 'physics' in n or 'পদার্থ' in n: return 70
    if 'chemistry' in n or 'রসায়ন' in n: return 80
    if 'biology' in n or 'জীব' in n: return 90
    if 'science' in n or 'বিজ্ঞান' in n: return 100
    return 500

# Proper weight by KEY (not label)
def get_weight_by_key(key):
    weight_map = {
        'bangla': 11, 'bangla_p1': 11, 'bangla_p2': 12, 'bangla_combined': 11,
        'english': 21, 'english_p1': 21, 'english_p2': 22, 'english_combined': 21,
        'math': 30,
        'religion': 40, 'religion_merged': 40,
        'ict': 50,
        'bgs': 60,
        'physics': 70,
        'chemistry': 80,
        'biology': 90,
        'science': 100,
        'higher': 1000,
        'accounting': 150,
        'finance': 160,
        'business': 170,
        'history': 180,
        'geography': 190,
        'civics': 200,
        'economics': 210,
        'agriculture': 220,
    }
    return weight_map.get(key, 500)

SCHOOL_ID = 63
pr(f"=== SCHOOL {SCHOOL_ID} SUBJECT DIAGNOSTIC ===")
pr()

# First inspect the Subject model to know the correct filter field
pr("Subject model fields: " + ', '.join([f.name for f in Subject._meta.get_fields()]))
pr()

# Get subjects - try all possible school-related fields
subjects = None
for field_attempt in ['school_id', 'school']:
    try:
        qs = Subject.objects.filter(**{field_attempt: SCHOOL_ID})
        count = qs.count()
        pr(f"Trying filter '{field_attempt}={SCHOOL_ID}': found {count} rows")
        if count > 0:
            subjects = qs
            break
    except Exception as e:
        pr(f"Filter '{field_attempt}' FAILED: {type(e).__name__}: {e}")

if subjects is None:
    pr("No school filter worked. Listing ALL subjects and filtering by related classroom.school")
    all_subjects = Subject.objects.all()
    pr(f"Total subjects in DB: {all_subjects.count()}")
    matched = []
    for s in all_subjects.iterator():
        try:
            if hasattr(s, 'classrooms'):
                for c in s.classrooms.all():
                    if hasattr(c, 'school_id') and c.school_id == SCHOOL_ID:
                        matched.append(s)
                        break
                    elif hasattr(c, 'school') and hasattr(c.school, 'id') and c.school.id == SCHOOL_ID:
                        matched.append(s)
                        break
        except Exception as e:
            pass
    pr(f"Found {len(matched)} subjects via classroom.school")
    subjects = matched
    pr()

# If we got a QuerySet, convert to list
if hasattr(subjects, 'iterator'):
    subjects = list(subjects)

pr(f"Final subject count for analysis: {len(subjects)}")
pr()

# Group by normalized key
by_key = defaultdict(list)

pr("-" * 120)
pr(f"{'ID':<5} {'NAME':<40} {'CLASSROOMS':<18} {'STD_KEY':<15} {'W_LABEL':<8} {'W_KEY':<8}")
pr("-" * 120)

for subj in subjects:
    name = subj.name
    try:
        cls_list = list(subj.classrooms.values_list('name', flat=True))
        cls_str = ', '.join(cls_list[:3])
        if len(cls_list) > 3:
            cls_str += f" (+{len(cls_list)-3})"
    except Exception as e:
        cls_str = "N/A"
    std_key = normalize_subj_key(name)
    w_label = get_weight_by_label(name)
    w_key = get_weight_by_key(std_key)
    pr(f"{subj.id:<5} {str(name)[:38]:<40} {str(cls_str)[:16]:<18} {std_key:<15} {w_label:<8} {w_key:<8}")
    by_key[std_key].append(subj)

pr()
pr("=== DUPLICATE SUBJECTS BY STANDARD KEY (multi-ID entries that share a key) ===")
pr()
for key, subs in sorted(by_key.items()):
    if len(subs) > 1:
        pr(f"KEY '{key}' -> {len(subs)} Subject IDs: " + ", ".join(
            [f"#{s.id}={s.name}" for s in subs]
        ))
        pr(f"  Weight by label vs Weight by key comparison:")
        current_label_weight_sort = sorted(subs, key=lambda s: get_weight_by_label(s.name))
        current_key_weight_sort = sorted(subs, key=lambda s: get_weight_by_key(normalize_subj_key(s.name)))
        labels_clw = [s.name for s in current_label_weight_sort]
        labels_ckw = [s.name for s in current_key_weight_sort]
        pr(f"    Current (label-based sort order): {labels_clw}")
        pr(f"    Fixed   (key-based sort order):   {labels_ckw}")
        if labels_clw != labels_ckw:
            pr(f"    ⚠️  SWAP DETECTED! Columns will be misaligned with mark data.")
        else:
            pr(f"    OK - no swap in this key group")
        pr()

# Now simulate the ACTUAL scenario where the 3 mismatches happen
# (not just dup per key, but first-seen-label per key produces a label/key mismatch with weight)
pr("=== SCENARIO SIMULATION: displaySubjects header list + cell lookup ===")
pr()
pr("Simulating: for each STANDARD KEY, pick FIRST subject's name as label")
pr("Then sorting by getWeight(LABEL) -vs- getWeight(KEY)")
pr()

# Build displaySubjects simulation
key_to_first_label = {}
key_to_first_subj = {}
for key, subs in sorted(by_key.items()):
    # The first subject (by lowest ID or first encountered) determines the LABEL
    first_subj = min(subs, key=lambda s: s.id)
    key_to_first_label[key] = first_subj.name
    key_to_first_subj[key] = first_subj

display_subjects = [
    {'label': key_to_first_label[key], 'key': key}
    for key in by_key.keys()
    if key in ['chemistry', 'biology', 'finance', 'business', 'history', 'civics']
]

pr("Display subjects before sort (relevant keys only):")
for s in display_subjects:
    pr(f"  key={s['key']:<10} label={s['label']}")
pr()

pr("After sorting WITH BUG (getWeight by label):")
sorted_bug = sorted(display_subjects, key=lambda x: get_weight_by_label(x['label']))
for i, s in enumerate(sorted_bug):
    pr(f"  Col#{i} LABEL={s['label']:<25} KEY={s['key']:<10} W(label)={get_weight_by_label(s['label'])} W(key)={get_weight_by_key(s['key'])}")
pr()

pr("After sorting FIXED (getWeight by key):")
sorted_fixed = sorted(display_subjects, key=lambda x: get_weight_by_key(x['key']))
for i, s in enumerate(sorted_fixed):
    pr(f"  Col#{i} LABEL={s['label']:<25} KEY={s['key']:<10} W(label)={get_weight_by_label(s['label'])} W(key)={get_weight_by_key(s['key'])}")
pr()

pr("If a student has marks for:")
pr("  - chemistry: 80")
pr("  - biology: 75")
pr("  - finance: 85")
pr("  - business: 70")
pr("  - history: 90")
pr("  - civics: 65")
pr()
pr("BUG scenario rendering (resMap.get(col.key) picks marks by KEY, but user reads LABEL):")
marks = {'chemistry': 80, 'biology': 75, 'finance': 85, 'business': 70, 'history': 90, 'civics': 65}
for i, s in enumerate(sorted_bug):
    pr(f"  Col#{i} LABEL={s['label']:<25} -> shows marks for KEY={s['key']:<10} = {marks[s['key']]}")
pr()
pr("^^ THAT IS THE BUG! Header says one subject name, cell shows another subject's marks ^^")
pr()

# Write to file
with open('debug_school63_output.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out_lines))
pr()
pr("Diagnostic complete. Full output saved to debug_school63_output.txt")
