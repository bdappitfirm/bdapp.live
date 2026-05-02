from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('schools', '0004_advertisement'),
        ('users', '0014_profile_class_teacher_classroom_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='SupportCall',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('room_name', models.CharField(max_length=200, unique=True)),
                ('requester_label', models.CharField(blank=True, default='', max_length=200)),
                ('status', models.CharField(choices=[('waiting', 'Waiting'), ('accepted', 'Accepted'), ('ended', 'Ended'), ('cancelled', 'Cancelled'), ('rejected', 'Rejected')], default='waiting', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('accepted_at', models.DateTimeField(blank=True, null=True)),
                ('ended_at', models.DateTimeField(blank=True, null=True)),
                ('last_client_ping_at', models.DateTimeField(blank=True, null=True)),
                ('accepted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='support_calls_accepted', to=settings.AUTH_USER_MODEL)),
                ('requester', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='support_calls_requested', to=settings.AUTH_USER_MODEL)),
                ('school', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='support_calls', to='schools.school')),
            ],
            options={
                'indexes': [
                    models.Index(fields=['school', 'status'], name='users_supcall_sch_stat_idx'),
                    models.Index(fields=['status', 'created_at'], name='users_supcall_stat_cre_idx'),
                    models.Index(fields=['requester', 'status'], name='users_supcall_req_stat_idx'),
                ],
            },
        ),
    ]
