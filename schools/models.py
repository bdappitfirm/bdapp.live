from django.db import models
from django.utils import timezone
import os

class School(models.Model):
    name = models.CharField(max_length=255)
    ein = models.CharField(max_length=50, blank=True, null=True, verbose_name="EIIN Number")
    email = models.EmailField(blank=True, null=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True)
    logo = models.ImageField(upload_to='school_logos/', blank=True, null=True)
    logo_thumbnail = models.ImageField(upload_to='school_logos_thumb/', blank=True, null=True)
    principal_name = models.CharField(max_length=255, blank=True, null=True)
    principal_signature = models.ImageField(upload_to='school_signatures/', blank=True, null=True, help_text="Principal's signature (PNG/JPG/JPEG)")
    school_seal = models.ImageField(upload_to='school_seals/', blank=True, null=True, help_text="School seal (PNG/JPG/JPEG)")
    number_of_buildings = models.IntegerField(default=1, blank=True, null=True, verbose_name="Number of Buildings")

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Image optimization imports inside to avoid circular import if any
        from users.image_utils import resize_image, create_thumbnail

        is_new_logo = False
        if self.pk:
            try:
                old_school = School.objects.get(pk=self.pk)
                if self.logo and old_school.logo != self.logo:
                    is_new_logo = True
            except School.DoesNotExist:
                is_new_logo = True
        elif self.logo:
            is_new_logo = True

        super().save(*args, **kwargs)

        if is_new_logo and self.logo:
            try:
                # Resize original logo to max 600x600 (logos don't need to be huge)
                resize_image(self.logo, size=(600, 600))
                # Create thumbnail 100x100
                thumb_content = create_thumbnail(self.logo, size=(100, 100))
                if thumb_content:
                    name = os.path.basename(self.logo.name)
                    self.logo_thumbnail.save(f"thumb_{name}", thumb_content, save=False)
                    super().save(update_fields=['logo_thumbnail'])
            except Exception as e:
                print(f"School logo optimization error: {e}")


class BanbeisInfo(models.Model):
    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name='banbeis_info')

    # Basic Info
    establishment_year = models.CharField(max_length=4, blank=True, null=True)
    school_type = models.CharField(max_length=50, choices=[('gov', 'Government'), ('pvt', 'Private')], default='pvt')
    gender_mix = models.CharField(max_length=50, choices=[('boys', 'Boys'), ('girls', 'Girls'), ('co-ed', 'Co-Education')], default='co-ed')
    shifts = models.CharField(max_length=100, default='Morning')
    management_type = models.CharField(max_length=100, default='Managing Committee')

    # Infrastructure
    total_land_area = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="In decimals")
    building_condition = models.CharField(max_length=100, default='Good')
    total_classrooms = models.IntegerField(default=0)
    toilets_count = models.IntegerField(default=0)
    has_safe_water = models.BooleanField(default=True)
    has_electricity = models.BooleanField(default=True)
    has_internet = models.BooleanField(default=True)
    has_library = models.BooleanField(default=True)
    has_playground = models.BooleanField(default=True)
    has_boundary_wall = models.BooleanField(default=True)
    has_multimedia_classroom = models.BooleanField(default=True)

    # Financial/Facilities
    mid_day_meal = models.BooleanField(default=False)
    has_ramp_for_disabled = models.BooleanField(default=False)

    # Geography
    latitude = models.CharField(max_length=50, blank=True, null=True)
    longitude = models.CharField(max_length=50, blank=True, null=True)

    # Metadata
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"BANBEIS Data for {self.school.name}"


class Advertisement(models.Model):
    TYPE_CHOICES = (
        ('image', 'Image'),
        ('video', 'Video'),
    )
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='advertisements', null=True, blank=True)
    text = models.CharField(max_length=255, blank=True)
    link = models.URLField(blank=True)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='image')
    media = models.FileField(upload_to='school_ads/', null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f"{self.school.name} - {self.type} - {self.text[:20] if self.text else 'Ad'}"


class SchoolOnboarding(models.Model):
    school = models.OneToOneField(School, on_delete=models.CASCADE, related_name='onboarding')
    headmaster_name = models.CharField(max_length=255, blank=True, null=True)
    headmaster_photo = models.ImageField(upload_to='headmaster_photos/', null=True, blank=True)
    is_processed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Onboarding for {self.school.name}"

class OnboardingClassConfig(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='onboarding_configs')
    class_name = models.CharField(max_length=100, help_text="e.g. Class 6, Class 7")
    section_name = models.CharField(max_length=100, default='A')
    boy_count = models.IntegerField(default=0)
    girl_count = models.IntegerField(default=0)
    boy_dress_color = models.CharField(max_length=100, blank=True, help_text="Keyword to match boy photos")
    girl_dress_color = models.CharField(max_length=100, blank=True, help_text="Keyword to match girl photos")

    def __str__(self):
        return f"{self.class_name} ({self.section_name}) - {self.school.name}"
