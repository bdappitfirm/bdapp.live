from django.contrib import admin
from .models import School, Advertisement, SchoolOnboarding, OnboardingClassConfig
from .onboarding import onboard_school


@admin.register(Advertisement)
class AdvertisementAdmin(admin.ModelAdmin):
    list_display = ('id', 'school', 'type', 'text', 'created_at')
    list_filter = ('school', 'type', 'created_at')
    search_fields = ('text', 'link')
    readonly_fields = ('created_at',)


class SchoolOnboardingInline(admin.StackedInline):
    model = SchoolOnboarding
    can_delete = False
    verbose_name_plural = 'Onboarding Configuration'

class OnboardingClassConfigInline(admin.TabularInline):
    model = OnboardingClassConfig
    extra = 1
    verbose_name = 'Class & Student Configuration'
    verbose_name_plural = 'Classes & Students Setup'


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'address', 'principal_name')
    list_display_links = ('id', 'name')
    search_fields = ('name', 'address', 'principal_name')
    inlines = [SchoolOnboardingInline, OnboardingClassConfigInline]

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        # Trigger onboarding automation
        success, message = onboard_school(form.instance.id)
        if success:
            self.message_user(request, "🚀 স্কুল অটোমেশন সফলভাবে সম্পন্ন হয়েছে! প্রধান শিক্ষক প্রোফাইল, সাবজেক্ট এবং স্টুডেন্ট ডাটা তৈরি করা হয়েছে।")
        else:
            if message != "Already processed":
                self.message_user(request, f"⚠️ অটোমেশন সতর্কবার্তা: {message}", level='WARNING')
