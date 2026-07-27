from django.db.models.signals import post_save
from django.dispatch import receiver
from schools.models import School
from .utils import auto_setup_school_subjects

@receiver(post_save, sender=School)
def school_post_save(sender, instance, created, **kwargs):
    if created:
        auto_setup_school_subjects(instance)
