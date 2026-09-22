import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from results.models import Examination

def fix_exam_types():
    print("🔍 Fixing examination types based on examination names...")
    exams = Examination.objects.all()
    updated = 0
    for e in exams:
        name_lower = (e.name or "").lower()
        old_type = e.exam_type
        new_type = old_type

        if any(w in name_lower for w in ['প্রাক', 'pre-test', 'pre test', 'pre_test']):
            new_type = 'pre_test'
        elif any(w in name_lower for w in ['নির্বাচনী', 'টেস্ট', 'test']):
            new_type = 'test'
        elif any(w in name_lower for w in ['অর্ধ-বার্ষিক', 'অর্ধ বার্ষিক', 'half yearly', 'half_yearly', 'semi', 'mid']):
            new_type = 'half_yearly'
        elif any(w in name_lower for w in ['বার্ষিক', 'annual', 'final']):
            new_type = 'annual'
        elif any(w in name_lower for w in ['মডেল', 'model']):
            new_type = 'model'
        elif any(w in name_lower for w in ['টার্মিনাল', 'terminal', 'term']):
            new_type = 'terminal'

        if old_type != new_type:
            print(f"Updating Exam #{e.id} '{e.name}' (Class: {e.classroom}): exam_type '{old_type}' -> '{new_type}'")
            e.exam_type = new_type
            e.save(update_fields=['exam_type'])
            updated += 1

    print(f"🏁 Finished fixing exam types. Total updated: {updated}")

if __name__ == "__main__":
    fix_exam_types()
