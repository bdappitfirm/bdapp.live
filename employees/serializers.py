from rest_framework import serializers

from .models import Department, Designation, Employee


class DepartmentSerializer(serializers.ModelSerializer):
    designation_count = serializers.SerializerMethodField()
    employee_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = '__all__'

    def get_designation_count(self, obj):
        return obj.designations.count()

    def get_employee_count(self, obj):
        return obj.employees.count()


class DesignationSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_name_bn = serializers.CharField(source='department.name_bn', read_only=True)

    class Meta:
        model = Designation
        fields = '__all__'


class EmployeeSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    designation_name = serializers.CharField(source='designation.name', read_only=True)
    reporting_manager_name = serializers.SerializerMethodField()
    school_name = serializers.CharField(source='school.name', read_only=True)
    photo_url = serializers.SerializerMethodField()
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    employment_type_display = serializers.CharField(source='get_employment_type_display', read_only=True)
    employment_status_display = serializers.CharField(source='get_employment_status_display', read_only=True)
    has_login = serializers.SerializerMethodField()
    login_username = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = '__all__'
        read_only_fields = ('employee_id',)

    def get_reporting_manager_name(self, obj):
        return obj.reporting_manager.name_en if obj.reporting_manager else None

    def get_photo_url(self, obj):
        if not obj.photo:
            return None
        try:
            request = self.context.get('request')
            url = obj.photo.url
            return request.build_absolute_uri(url) if request else url
        except Exception:
            return None

    def get_has_login(self, obj):
        return bool(obj.user_id)

    def get_login_username(self, obj):
        return obj.user.username if obj.user_id and obj.user else None
