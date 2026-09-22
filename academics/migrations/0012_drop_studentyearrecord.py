# Generated manually to clean up legacy orphan table

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('academics', '0011_studentprofile_ssc_board_studentprofile_ssc_gpa_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql='DROP TABLE IF EXISTS academics_studentyearrecord CASCADE;',
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
