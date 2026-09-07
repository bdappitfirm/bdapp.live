from django.contrib import admin
from .models import School, Advertisement, SchoolOnboarding, OnboardingClassConfig
from .onboarding import onboard_school
from django.http import HttpResponse
from django.urls import path, reverse
from django.shortcuts import get_object_or_404
from rest_framework.test import APIRequestFactory
from academics.views import ImportStudentsAPI
from django.middleware.csrf import get_token


@admin.register(Advertisement)
class AdvertisementAdmin(admin.ModelAdmin):
    list_display = ('id', 'school', 'type', 'text', 'created_at')
    list_filter = ('school', 'type', 'created_at')
    search_fields = ('text', 'link')
    readonly_fields = ('created_at',)


class SchoolOnboardingInline(admin.StackedInline):
    model = SchoolOnboarding
    fields = ('school_type', 'headmaster_name', 'headmaster_photo', 'class_range_start', 'class_range_end', 'sample_student_count', 'is_processed')
    can_delete = False
    verbose_name_plural = 'Onboarding Configuration'

class OnboardingClassConfigInline(admin.TabularInline):
    model = OnboardingClassConfig
    extra = 1
    verbose_name = 'Class & Student Configuration'
    verbose_name_plural = 'Classes & Students Setup'


def reset_and_trigger_onboarding(modeladmin, request, queryset):
    for school in queryset:
        onboarding = getattr(school, 'onboarding', None)
        if onboarding:
            onboarding.is_processed = False
            onboarding.save()

        from .onboarding import onboard_school
        success, message = onboard_school(school.id)
        if success:
            modeladmin.message_user(request, f"🚀 {school.name}: অটোমেশন সফল হয়েছে।")
        else:
            modeladmin.message_user(request, f"❌ {school.name}: {message}", level='ERROR')

reset_and_trigger_onboarding.short_description = "নির্বাচিত স্কুলগুলোর অটোমেশন রিসেট এবং পুনরায় চালু করুন"


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'address', 'principal_name')
    list_display_links = ('id', 'name')
    search_fields = ('name', 'address', 'principal_name')
    inlines = [SchoolOnboardingInline, OnboardingClassConfigInline]
    actions = [reset_and_trigger_onboarding]

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path('<int:school_id>/import-students/', self.admin_site.admin_view(self.import_students_view),
                 name='schools_school_import_students'),
        ]
        return custom + urls

    def import_students_view(self, request, school_id):
        if request.method == 'POST':
            f = request.FILES.get('file')
            if not f:
                return HttpResponse('No file uploaded. <a href="">Back</a>')
            factory = APIRequestFactory()
            drf_request = factory.post(f'/api/academics/imports/students/?school={school_id}', {
                'school': school_id,
            }, format='multipart')
            drf_request.FILES['file'] = f
            drf_request._force_auth_user = request.user
            response = ImportStudentsAPI.as_view()(drf_request)

            status_code = response.status_code
            try:
                data = response.data
            except Exception as e:
                data = {'detail': f'Failed to parse response: {e}'}

            if status_code != 200:
                error_detail = data.get('detail', 'Unknown error')
                html = f"""
                <h1>Import Failed</h1>
                <p style="color: red;">Error: {error_detail}</p>
                <p>Status Code: {status_code}</p>
                <p><a href="{reverse('admin:schools_school_import_students', args=[school_id])}">Try again</a> |
                   <a href="{reverse('admin:schools_school_change', args=[school_id])}">Back to school</a></p>
                """
                return HttpResponse(html)

            created = data.get('created', 0)
            updated = data.get('updated', 0)
            errors = data.get('errors', [])
            error_details = '<br>'.join([f"Row {e.get('row')}: {e.get('error')}" for e in errors[:20]])
            if len(errors) > 20:
                error_details += f'<br>... and {len(errors) - 20} more errors'

            html = f"""
            <h1>Import Result</h1>
            <p><strong>Created:</strong> {created}</p>
            <p><strong>Updated:</strong> {updated}</p>
            <p><strong>Errors:</strong> {len(errors)}</p>
            {f'<div style="background: #fff3cd; padding: 10px; margin: 10px 0;"><strong>Error Details:</strong><br>{error_details}</div>' if errors else ''}
            <p><a href="{reverse('admin:schools_school_import_students', args=[school_id])}">Import more</a> |
               <a href="{reverse('admin:schools_school_change', args=[school_id])}">Back to school</a></p>
            """
            return HttpResponse(html)

        upload_action = reverse('admin:schools_school_import_students', args=[school_id])
        csrf = get_token(request)
        html = f"""
        <h1>Import Students for School ID {school_id}</h1>
        <form method="post" enctype="multipart/form-data">
          <input type="hidden" name="csrfmiddlewaretoken" value="{csrf}" />
          <input type="file" name="file" accept=".csv,.xlsx,.xlsm,.docx,.pdf,image/*" required />
          <button type="submit">Upload & Import</button>
        </form>
        <p><a href="{reverse('admin:schools_school_change', args=[school_id])}">Cancel</a></p>
        """
        return HttpResponse(html)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)

        # Check if onboarding exists and is not processed
        onboarding = getattr(form.instance, 'onboarding', None)
        if onboarding and not onboarding.is_processed:
            # Trigger onboarding automation
            success, message = onboard_school(form.instance.id)
            if success:
                self.message_user(request, "🚀 স্কুল অটোমেশন সফলভাবে সম্পন্ন হয়েছে! প্রধান শিক্ষক প্রোফাইল, ক্লাস, সেকশন এবং সাবজেক্ট ডাটা তৈরি করা হয়েছে।")
            else:
                self.message_user(request, f"⚠️ অটোমেশন সতর্কবার্তা: {message}", level='WARNING')
        elif onboarding and onboarding.is_processed:
            self.message_user(request, "ℹ️ অটোমেশন আগে থেকেই সম্পন্ন করা আছে। নতুন করে করতে চাইলে অ্যাকশন মেনু থেকে 'অটোমেশন রিসেট' করুন।")
