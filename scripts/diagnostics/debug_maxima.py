import os
import django
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.utils import get_subject_maxima, SECTION_MAXIMA

def run():
    subj = "Word Collection Achievement Test"
    group = "six_to_eight"
    maxima = get_subject_maxima(group, subj)
    print(f"Subject: {subj}, Group: {group}, Maxima: {maxima}")

    # Let's see why it might fail
    raw = subj.strip().lower()
    s = re.sub(r"\s*\(.*?\)\s*", "", raw).strip()
    s = re.sub(r"[-_.,]", " ", s).strip()
    s = " ".join(s.split())
    print(f"Normalized: '{s}'")

    group_maxima = SECTION_MAXIMA.get(group, {})
    found = False
    for k, v in group_maxima.items():
        if k in s or s in k:
            print(f"Matched key: '{k}'")
            found = True
            break
    if not found:
        print("No match found in loop")

if __name__ == "__main__":
    run()
