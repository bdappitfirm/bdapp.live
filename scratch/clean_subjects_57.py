import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from academics.models import ClassRoom, Section, Subject
from schools.models import School

school = School.objects.get(id=57)
print("Clean Populating Board Subjects for School 57:", school.name)

# 1. Delete junk subjects with '?' or bogus names
junk_ids = [s.id for s in Subject.objects.filter(school=school) if '?' in s.name or '?' in s.code]
if junk_ids:
    Subject.objects.filter(id__in=junk_ids).delete()
    print(f"Deleted {len(junk_ids)} junk subjects.")

all_classrooms = list(ClassRoom.objects.filter(school_id=57))
c_6_to_10 = all_classrooms
c_9_10 = [c for c in all_classrooms if "নবম" in c.name or "দশম" in c.name]

# Define canonical subjects list according to Education Board rules
subjects_def = [
    # General Core (Class 6-10)
    ("বাংলা ১ম পত্র", "১০১", c_6_to_10, []),
    ("বাংলা ২য় পত্র", "১০২", c_6_to_10, []),
    ("ইংরেজি ১ম পত্র", "১০৭", c_6_to_10, []),
    ("ইংরেজি ২য় পত্র", "১০৮", c_6_to_10, []),
    ("গণিত", "১০৯", c_6_to_10, []),
    ("বিজ্ঞান", "১২৭", c_6_to_10, []),
    ("বাংলাদেশ ও বিশ্বপরিচয়", "১৫০", c_6_to_10, []),
    ("ইসলাম ও নৈতিক শিক্ষা", "১১১", c_6_to_10, []),
    ("হিন্দুধর্ম ও নৈতিক শিক্ষা", "১১২", c_6_to_10, []),
    ("তথ্য ও যোগাযোগ প্রযুক্তি", "১৫৪", c_6_to_10, []),
    ("শারীরিক শিক্ষা ও স্বাস্থ্য", "১৪৭", c_6_to_10, []),
    ("ক্যারিয়ার শিক্ষা", "১৫৬", c_6_to_10, []),
    ("চারু ও কারুকলা", "১৪৮", c_6_to_10, []),
    ("কর্ম ও জীবনমুখী শিক্ষা", "১৪৯", c_6_to_10, []),
    ("কৃষি শিক্ষা", "১৩৪", c_6_to_10, []),
    ("গার্হস্থ্য বিজ্ঞান", "১৫১", c_6_to_10, []),

    # Class 9-10 Science Group
    ("পদার্থবিজ্ঞান", "১৩৬", c_9_10, ["বিজ্ঞান"]),
    ("রসায়ন", "১৩৭", c_9_10, ["বিজ্ঞান"]),
    ("জীববিজ্ঞান", "১৩৮", c_9_10, ["বিজ্ঞান"]),
    ("উচ্চতর গণিত", "১২৬", c_9_10, ["বিজ্ঞান"]),

    # Class 9-10 Business Studies Group
    ("হিসাববিজ্ঞান", "১৪৬", c_9_10, ["ব্যবসায়", "ব্যবসায়"]),
    ("ব্যবসায় উদ্যোগ", "১৪৩", c_9_10, ["ব্যবসায়", "ব্যবসায়"]),
    ("ফিন্যান্স ও ব্যাংকিং", "১৫২", c_9_10, ["ব্যবসায়", "ব্যবসায়"]),

    # Class 9-10 Humanities Group
    ("বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা", "১৫৩", c_9_10, ["মানবিক"]),
    ("পৌরনীতি ও নাগরিকতা", "১৪০", c_9_10, ["মানবিক"]),
    ("ভূগোল ও পরিবেশ", "১১০", c_9_10, ["মানবিক"]),
    ("অর্থনীতি", "১৪১", c_9_10, ["মানবিক"]),
]

created = 0
updated = 0

for name, code, cls_list, sec_kw in subjects_def:
    # Try exact match first
    subj = Subject.objects.filter(school=school, name=name).first()

    if not subj:
        # Check matching existing subject by code or partial name
        prefix = name.split()[0]
        subj = Subject.objects.filter(school=school, code=code).first()
        if not subj:
            subj = Subject.objects.filter(school=school, name__icontains=prefix).first()

    if not subj:
        subj = Subject.objects.create(school=school, name=name, code=code)
        created += 1
        print(f"CREATED: '{name}' (Code: {code})")
    else:
        if subj.name != name or subj.code != code:
            old = subj.name
            # Check if target name conflicts with another subject
            other = Subject.objects.filter(school=school, name=name).exclude(id=subj.id).first()
            if not other:
                subj.name = name
                subj.code = code
                subj.save()
                updated += 1
                print(f"UPDATED ID {subj.id}: '{old}' -> '{name}' (Code: {code})")
            else:
                print(f"USING EXISTING ID {other.id} for '{name}'")
                subj = other

    # Link classrooms
    for c in cls_list:
        subj.classrooms.add(c)

    # Link sections if specified
    if sec_kw:
        for c in cls_list:
            secs = Section.objects.filter(classroom=c)
            for s in secs:
                if any(kw in s.name.lower() for kw in sec_kw):
                    subj.sections.add(s)

print(f"\nFINALISED! Total Subjects in School 57: {Subject.objects.filter(school=school).count()}")
print("-" * 80)
for s in Subject.objects.filter(school=school).order_by('id'):
    c_names = ", ".join([c.name for c in s.classrooms.all()]) or "None"
    s_names = ", ".join([sec.name for sec in s.sections.all()]) or "All"
    print(f"  ID {s.id:5d} | Code: {s.code:5s} | Name: '{s.name:35s}' | Classrooms: [{c_names}] | Sections: [{s_names}]")
