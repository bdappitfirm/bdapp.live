import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from academics.models import Subject, ClassRoom, Section, StudentProfile
from results.models import Result

def fix_slash_subjects():
    print("🧹 Cleaning up slash-separated subjects...")
    slash_subjects = Subject.objects.filter(name__icontains='/')
    print(f"Found {slash_subjects.count()} subjects with slashes.")

    for subj in slash_subjects:
        parts = [p.strip() for p in subj.name.split('/') if p.strip()]
        print(f"Processing subject ID {subj.id}: '{subj.name}' -> Parts: {parts}")

        school = subj.school if hasattr(subj, 'school') else None
        if not school:
            cls = subj.classrooms.first()
            if cls: school = cls.school

        if not school:
            print(f"  ⚠️ Could not determine school for subject {subj.id}")
            continue

        classrooms = list(subj.classrooms.all())
        sections = list(subj.sections.all())

        # Create individual subjects if needed
        individual_subjects = {}
        for part in parts:
            ind_subj, _ = Subject.objects.get_or_create(school=school, name=part)
            for c in classrooms: ind_subj.classrooms.add(c)
            for s in sections: ind_subj.sections.add(s)
            individual_subjects[part.lower()] = ind_subj

        # Re-assign results referencing this slash subject based on student group
        results = Result.objects.filter(subject=subj)
        print(f"  - Re-assigning {results.count()} results...")
        for r in results:
            student = r.student
            group = (student.student_group or "").lower() if student else ""
            target_part = None

            for part in parts:
                p_low = part.lower()
                if group == 'science' and any(k in p_low for k in ['physics', 'chemistry', 'biology', 'higher', 'পদার্থ', 'রসায়ন', 'জীব', 'উচ্চতর']):
                    target_part = part
                    break
                elif group in ['commerce', 'business'] and any(k in p_low for k in ['accounting', 'finance', 'business', 'হিসাব', 'ফিন্যান্স', 'ব্যবসায়', 'ব্যবসায়']):
                    target_part = part
                    break
                elif group in ['arts', 'humanities'] and any(k in p_low for k in ['history', 'geography', 'civics', 'economics', 'ইতিহাস', 'ভূগোল', 'পৌরনীতি', 'অর্থনীতি']):
                    target_part = part
                    break
                elif any(k in p_low for k in ['কৃষি', 'agri', 'home', 'গার্হস্থ্য']):
                    if group in ['commerce', 'business', 'arts', 'humanities']:
                        target_part = part
                        break

            if not target_part and parts:
                target_part = parts[0] # Fallback to first part

            if target_part:
                target_key = target_part.lower()
                match_subj = None
                for k, sub in individual_subjects.items():
                    if k in target_key or target_key in k:
                        match_subj = sub
                        break
                if not match_subj:
                    match_subj = list(individual_subjects.values())[0]

                existing_res = Result.objects.filter(examination=r.examination, student=r.student, subject=match_subj).first()
                if existing_res:
                    r.delete()
                else:
                    r.subject = match_subj
                    try:
                        r.save(update_fields=['subject'])
                    except Exception:
                        r.delete()

        # Delete the slash subject if no results left
        if Result.objects.filter(subject=subj).count() == 0:
            subj.delete()
            print(f"  🗑️ Deleted empty slash subject: {subj.name}")
        else:
            print(f"  ⚠️ Slash subject {subj.name} still has results, kept.")

    print("🏁 Slash subjects cleanup finished.")

if __name__ == "__main__":
    fix_slash_subjects()
