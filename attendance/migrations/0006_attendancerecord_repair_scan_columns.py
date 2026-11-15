"""Repair the attendance schema drift that blocks QR/employee attendance.

Two schema drifts were found on live databases:

1. Migration ``0003_attendancerecord_device_id_and_more`` is recorded as applied
   but the columns were never created, so the raw-SQL upsert in
   ``AttendanceRecordViewSet.bulk_save`` failed with
   ``column "device_id" ... does not exist``.
2. ``student_id`` is ``NOT NULL`` in the database although the model declares
   ``student`` as ``null=True, blank=True``, so employee-only attendance rows
   failed with ``null value in column "student_id" ... violates not-null constraint``.

Both statements are idempotent, so they are safe to run on every environment.
"""

from django.db import migrations

REPAIR_SQL = """
ALTER TABLE attendance_attendancerecord
    ADD COLUMN IF NOT EXISTS device_id varchar(200) NULL,
    ADD COLUMN IF NOT EXISTS scan_time timestamp with time zone NULL,
    ADD COLUMN IF NOT EXISTS session varchar(50) NULL,
    ADD COLUMN IF NOT EXISTS operator_log jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE attendance_attendancerecord
    ALTER COLUMN student_id DROP NOT NULL;
"""

# Reverse only removes the columns that this migration may have created; the
# ``DROP NOT NULL`` is intentionally not reverted because existing employee rows
# would make a ``SET NOT NULL`` fail.
REVERSE_SQL = """
ALTER TABLE attendance_attendancerecord
    DROP COLUMN IF EXISTS device_id,
    DROP COLUMN IF EXISTS scan_time,
    DROP COLUMN IF EXISTS session,
    DROP COLUMN IF EXISTS operator_log;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0005_attendancerecord_employee'),
    ]

    operations = [
        migrations.RunSQL(REPAIR_SQL, reverse_sql=REVERSE_SQL),
    ]
