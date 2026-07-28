from django.db.models.signals import post_save
from django.dispatch import receiver
from schools.models import School

@receiver(post_save, sender=School)
def school_post_save(sender, instance, created, **kwargs):
    # Stopped auto-creating 50+ subjects to avoid "ghost subjects" in database.
    # Schools will now add their own subjects as needed.
    pass
