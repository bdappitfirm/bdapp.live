import re

from django.db import migrations

VALID_TYPES = ('half_yearly', 'pre_test', 'annual', 'test', 'model', 'first_term', 'terminal')


def normalize_exam_type(name, current_type):
    """Same rules as results.models.normalize_db_exam_type (kept inline so the
    migration stays deterministic and independent of the current model code)."""
    n = (name or '').lower().strip()
    t = (current_type or '').lower().strip()
    combined = f"{n} {t}".strip()

    if re.search(r'pre[-_\s]?test|প্রাক[-_\s]?নির্বাচনী', combined, re.I):
        return 'pre_test'
    if re.search(r'half[-_\s]?yearly|semi|mid|অর্ধ[-_\s]?বার্ষিক', combined, re.I):
        return 'half_yearly'
    if re.search(r'annual|final|বার্ষিক', combined, re.I):
        return 'annual'
    if re.search(r'model|মডেল', combined, re.I):
        return 'model'
    if re.search(r'first[-_\s]?term|প্রথম[-_\s]?সাময়িক', combined, re.I):
        return 'first_term'
    if re.search(r'terminal|টার্মিনাল', combined, re.I):
        return 'terminal'
    if re.search(r'test|নির্বাচনী|টেস্ট', combined, re.I):
        return 'test'

    if t in VALID_TYPES:
        return t
    return t or 'test'


def sync_exam_types(apps, schema_editor):
    """Align every stored Examination.exam_type with its name.

    Legacy rows were saved with a free-text/incorrect type (e.g. a Pre-Test named
    "প্রাক-নির্বাচনী" stored as `half_yearly`), which made the backend's
    `examination__exam_type=` filters return the wrong examination's results.
    """
    Examination = apps.get_model('results', 'Examination')
    to_update = []
    for ex in Examination.objects.all().only('id', 'name', 'exam_type'):
        norm = normalize_exam_type(ex.name, ex.exam_type)
        if norm and norm != ex.exam_type:
            ex.exam_type = norm
            to_update.append(ex)
    if to_update:
        Examination.objects.bulk_update(to_update, ['exam_type'])
        try:
            # bulk_update() fires no post_save signal, so cached report payloads
            # still hold the old exam_type - drop them.
            from backend.cache_utils import bump_global_cache_version
            bump_global_cache_version()
        except Exception:
            pass


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('results', '0006_alter_examination_exam_type'),
    ]

    operations = [
        migrations.RunPython(sync_exam_types, noop),
    ]
