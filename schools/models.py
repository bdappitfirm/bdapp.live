from django.db import models
from django.utils import timezone

class School(models.Model):
    name = models.CharField(max_length=255)
    ein = models.CharField(max_length=50, blank=True, null=True, verbose_name="EIIN Number")
    email = models.EmailField(blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True)
    logo = models.ImageField(upload_to='school_logos/', blank=True, null=True)
    principal_name = models.CharField(max_length=255, blank=True, null=True)
    principal_signature = models.ImageField(upload_to='school_signatures/', blank=True, null=True, help_text="Principal's signature (PNG/JPG/JPEG)")
    school_seal = models.ImageField(upload_to='school_seals/', blank=True, null=True, help_text="School seal (PNG/JPG/JPEG)")
    number_of_buildings = models.IntegerField(default=1, blank=True, null=True, verbose_name="Number of Buildings")

    def __str__(self):
        return self.name


class Advertisement(models.Model):
    TYPE_CHOICES = (
        ('image', 'Image'),
        ('video', 'Video'),
    )
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='advertisements', null=True, blank=True)
    text = models.CharField(max_length=255, blank=True)
    link = models.URLField(blank=True)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='image')
    media = models.FileField(upload_to='school_ads/')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f"{self.school.name} - {self.type} - {self.text[:20] if self.text else 'Ad'}"
