from rest_framework import serializers
from .models import AttendanceRecord, StudentAttendanceSummary
from django.db import connection

class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    classroom_name = serializers.SerializerMethodField()
    section_name = serializers.SerializerMethodField()
    taken_by = serializers.SerializerMethodField()
    employee_name = serializers.SerializerMethodField()
    employee_code = serializers.SerializerMethodField()
    employee_designation = serializers.SerializerMethodField()
    employee_department = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceRecord
        fields = [
            'id','school','student','employee',
            'student_name','classroom_name','section_name',
            'employee_name','employee_code','employee_designation','employee_department',
            'date','present','note',
            'taken_by','taken_by_name',
            'device_id', 'scan_time', 'session', 'operator_log',
            'created_at'
        ]

    def __init__(self, *args, **kwargs):
        # Dynamic field filtering based on DB schema
        super().__init__(*args, **kwargs)
        try:
            with connection.cursor() as cursor:
                db_cols = {c.name for c in connection.introspection.get_table_description(cursor, 'attendance_attendancerecord')}

            allowed = set(self.fields.keys())
            # Check model fields that are actual DB columns
            model_fields = {f.name for f in AttendanceRecord._meta.get_fields() if not f.is_relation}
            for mf in model_fields:
                if mf not in db_cols and mf in self.fields:
                    self.fields.pop(mf)
            # Foreign keys are relations (not in model_fields) so guard them separately
            if 'employee_id' not in db_cols and 'employee' in self.fields:
                self.fields.pop('employee')
        except Exception:
            pass

    def get_student_name(self, obj):
        try:
            stu = getattr(obj, 'student', None)
            if stu:
                user = getattr(stu, 'user', None)
                if user:
                    fn = getattr(user, 'first_name', '') or ''
                    ln = getattr(user, 'last_name', '') or ''
                    return f"{fn} {ln}".strip() or getattr(user, 'username', 'Unknown')
            emp = getattr(obj, 'employee', None)
            if emp:
                return emp.name_en or emp.name_bn or 'Employee'
        except Exception: pass
        return "Unknown Student"
    
    def get_classroom_name(self, obj):
        try:
            stu = getattr(obj, 'student', None)
            if stu and stu.classroom:
                return stu.classroom.name
        except Exception: pass
        return 'N/A'
    
    def get_section_name(self, obj):
        try:
            stu = getattr(obj, 'student', None)
            if stu and stu.section:
                return stu.section.name
        except Exception: pass
        return 'N/A'
    
    def get_taken_by(self, obj):
        try:
            u = getattr(obj, 'taken_by_user', None)
            if not u: return None
            return {
                'id': u.id,
                'username': u.username,
                'name': f"{u.first_name} {u.last_name}".strip() or u.username
            }
        except Exception: return None

    def get_employee_name(self, obj):
        try:
            emp = getattr(obj, 'employee', None)
            if emp:
                return emp.name_en or emp.name_bn or 'Employee'
        except Exception: pass
        return None

    def get_employee_code(self, obj):
        try:
            emp = getattr(obj, 'employee', None)
            if emp:
                return emp.employee_id
        except Exception: pass
        return None

    def get_employee_designation(self, obj):
        try:
            emp = getattr(obj, 'employee', None)
            if emp and emp.designation:
                return emp.designation.name
        except Exception: pass
        return None

    def get_employee_department(self, obj):
        try:
            emp = getattr(obj, 'employee', None)
            if emp and emp.department:
                return emp.department.name
        except Exception: pass
        return None

class StudentAttendanceSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentAttendanceSummary
        fields = '__all__'
