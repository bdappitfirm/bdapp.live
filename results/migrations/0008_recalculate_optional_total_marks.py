from django.db import migrations
from django.db.models import Q


def recalculate_overall_totals(apps, schema_editor):
    """চতুর্থ (ঐচ্ছিক/অপশনাল) বিষয়ের নম্বর এখন থেকে মোট প্রাপ্ত নম্বরে পুরোটা যোগ হয় না —
    কেবল তার সর্বোচ্চ নম্বরের ৪০% এর বেশি অংশ যোগ হয় (Class Results / Merit List /
    Result Card এর সমান নিয়ম, দেখুন results/signals.py)। যেসব শিক্ষার্থীর ঐচ্ছিক বিষয়
    আছে, তাদের পুরোনো (পুরো নম্বর যোগ করা) StudentOverallResult সারিগুলো নতুন করে হিসাব
    করে ঠিক করা হচ্ছে। ঐচ্ছিক বিষয় নেই যাদের, তাদের হিসাব বদলায় না — তাই শুধু তারাই
    আবার হিসাব করা হয় (সব শিক্ষার্থীর জন্য করলে হাজারো examines-এ এটি অনেক ধীর হয়ে যায়)।
    """
    from academics.models import StudentProfile
    from results import signals as result_signals
    from results.models import Examination, Result

    student_ids_with_optional = set(
        StudentProfile.objects.filter(optional_subject__isnull=False).values_list('id', flat=True)
    )

    pairs_iter = Result.objects.values_list('examination_id', 'student_id').distinct().iterator()

    pairs = {}
    for exam_id, student_id in pairs_iter:
        if student_id in student_ids_with_optional:
            pairs.setdefault(exam_id, []).append(student_id)

    # নামের ভিতরে "optional / ঐচ্ছিক / fourth / ৪র্থ" থাকলে signals ওটাকে ঐচ্ছিক ধরে
    for exam_id, student_id in (
        Result.objects.filter(
            Q(subject__name__icontains='optional')
            | Q(subject__name__icontains='ঐচ্ছিক')
            | Q(subject__name__icontains='fourth')
            | Q(subject__name__icontains='৪র্থ')
        )
        .values_list('examination_id', 'student_id')
        .distinct()
        .iterator()
    ):
        if student_id not in pairs.get(exam_id, []):
            pairs.setdefault(exam_id, []).append(student_id)

    # প্রতি ছাত্রের হিসাব শেষে calculate_ranks() পুরো পরীক্ষার সবাইকে আবার সাজায়, ফলে
    # বড় পরীক্ষায় কাজটা অহেতুক ভারী হয়ে যায়। তাই লুপের ভিতরে র‍্যাংক বন্ধ রেখে প্রতি
    # পরীক্ষার শেষে একবারই র‍্যাংক হিসাব করা হচ্ছে।
    real_calculate_ranks = result_signals.calculate_ranks
    result_signals.calculate_ranks = lambda examination: None

    exams = []
    total = 0
    try:
        for exam_id, student_ids in pairs.items():
            examination = Examination.objects.filter(pk=exam_id).first()
            if not examination:
                continue
            exams.append(examination)
            print(f"  exam={exam_id} students={len(student_ids)}", flush=True)
            for student in StudentProfile.objects.filter(pk__in=student_ids).iterator():
                try:
                    result_signals.calculate_student_overall_result(examination, student)
                    total += 1
                except Exception as exc:  # এক ছাত্রের কারণে ডিপ্লয় যেন না ভাঙে
                    print(f"  [skip] exam={exam_id} student={student.pk}: {exc}", flush=True)
    finally:
        result_signals.calculate_ranks = real_calculate_ranks

    for examination in exams:
        try:
            real_calculate_ranks(examination)
        except Exception as exc:
            print(f"  [skip ranks] exam={examination.pk}: {exc}", flush=True)

    print(f"  overall results recalculated: {total}", flush=True)

    try:
        # পুরোনো মোট নম্বর ক্যাশে হয়ে থাকলে সেটাও বাতিল করতে হবে
        from backend.cache_utils import bump_global_cache_version
        bump_global_cache_version()
    except Exception:
        pass


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('results', '0007_sync_examination_exam_types'),
    ]

    operations = [
        migrations.RunPython(recalculate_overall_totals, noop),
    ]
