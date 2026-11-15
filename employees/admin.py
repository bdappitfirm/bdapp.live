from django.contrib import admin

from .models import Department, Designation, Employee


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'name_bn', 'code', 'school', 'is_active')
    list_filter = ('school', 'is_active')
    search_fields = ('name', 'name_bn', 'code')


@admin.register(Designation)
class DesignationAdmin(admin.ModelAdmin):
    list_display = ('name', 'name_bn', 'department', 'school', 'is_active')
    list_filter = ('school', 'is_active', 'department')
    search_fields = ('name', 'name_bn')


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'name_en', 'name_bn', 'department', 'designation',
                    'employment_status', 'school')
    list_filter = ('school', 'employment_status', 'employment_type', 'department')
    search_fields = ('employee_id', 'name_en', 'name_bn', 'mobile_number', 'nid_number')
