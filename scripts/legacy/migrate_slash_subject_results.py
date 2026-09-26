import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Result
from academics.models import Subject

def migrate_marks():
    print("🔄 Migrating marks from slash subjects to individual subjects...")
    slash_results = Result.objects.filter(subject__name__icontains='/')
    print(f"Found {slash_results.count()} results under slash subjects.")

    for r in slash_results:
        slash_sub_name = r.subject.name
        parts = [p.strip() for p in slash_sub_name.split('/') if p.strip()]

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
            target_part = parts[0]

        if target_part:
            ind_subj = Subject.objects.filter(school_id=r.examination.school_id, name__icontains=target_part).exclude(name__icontains='/').first()
            if ind_subj:
                target_res, _ = Result.objects.get_or_create(
                    examination=r.examination,
                    student=r.student,
                    subject=ind_subj,
                    defaults={
                        'written_marks': r.written_marks,
                        'mcq_marks': r.mcq_marks,
                        'practical_marks': r.practical_marks
                    }
                )
                if float(target_res.total_obtained or 0) == 0 and float(r.total_obtained or 0) > 0:
                    target_res.written_marks = r.written_marks
                    target_res.mcq_marks = r.mcq_marks
                    target_res.practical_marks = r.practical_marks
                    target_res.save()

        r.delete()

    print("🏁 Mark migration finished.")

if __name__ == "__main__":
    migrate_marks()
