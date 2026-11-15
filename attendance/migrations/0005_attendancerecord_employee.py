import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('employees', '0001_initial'),
        ('attendance', '0004_studentattendancesummary'),
    ]

    operations = [
        migrations.AddField(
            model_name='attendancerecord',
            name='employee',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='attendances', to='employees.employee'),
        ),
        migrations.AddIndex(
            model_name='attendancerecord',
            index=models.Index(fields=['employee'], name='att_rec_employee_idx'),
        ),
        # Required by the ON CONFLICT (employee_id, date) upsert in bulk_save
        migrations.RunSQL(
            "CREATE UNIQUE INDEX IF NOT EXISTS att_rec_employee_date_uniq ON attendance_attendancerecord (employee_id, date);",
            reverse_sql="DROP INDEX IF EXISTS att_rec_employee_date_uniq;",
        ),
    ]
