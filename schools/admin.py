from django.contrib import admin
from .models import School, Advertisement


@admin.register(Advertisement)
class AdvertisementAdmin(admin.ModelAdmin):
    list_display = ('id', 'school', 'type', 'text', 'created_at')
    list_filter = ('school', 'type', 'created_at')
    search_fields = ('text', 'link')
    readonly_fields = ('created_at',)


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'address', 'principal_name')
    list_display_links = ('id', 'name')
    search_fields = ('name', 'address', 'principal_name')
