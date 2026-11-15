from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from users.permissions import IsSchoolMember, is_global_admin
from .models import Department, Designation, Employee
from .serializers import DepartmentSerializer, DesignationSerializer, EmployeeSerializer

User = get_user_model()

# প্রাথমিক বিভাগ ও তাদের পদবি (BDapp IT Firm)
DEFAULT_DEPARTMENTS = [
    ('Administration', 'প্রশাসন', 'ADMIN', 'Managing Director', 'ম্যানেজিং ডিরেক্টর'),
    ('Marketing & Business Development', 'মার্কেটিং ও বিজনেস ডেভেলপমেন্ট', 'MKT', 'Marketing Manager', 'মার্কেটিং ম্যানেজার'),
    ('Field Operations', 'ফিল্ড অপারেশনস', 'FIELD', 'Field Operations Manager', 'ফিল্ড অপারেশনস ম্যানেজার'),
    ('Software Development', 'সফটওয়্যার ডেভেলপমেন্ট', 'DEV', 'Software Engineer', 'সফটওয়্যার ইঞ্জিনিয়ার'),
    ('Customer Support', 'কাস্টমার সাপোর্ট', 'SUP', 'Support Executive', 'সাপোর্ট এক্সিকিউটিভ'),
    ('Accounts & Finance', 'হিসাব ও অর্থ', 'ACC', 'Accountant', 'হিসাবরক্ষক'),
    ('Human Resources (HR)', 'মানব সম্পদ (HR)', 'HR', 'HR Manager', 'এইচআর ম্যানেজার'),
]


def resolve_school_id(request, data=None):
    """Query param -> request data -> user profile fallback."""
    sid = request.query_params.get('school') or request.query_params.get('school_id')
    if not sid and isinstance(data, dict):
        sid = data.get('school') or data.get('school_id')
    if sid:
        return sid
    if is_global_admin(request.user):
        return None
    profile = getattr(request.user, 'profile', None)
    return profile.school_id if profile and profile.school_id else None


class SchoolScopedViewSet(viewsets.ModelViewSet):
    """Base viewset that isolates data by school."""

    permission_classes = [IsSchoolMember]
    school_field = 'school_id'

    def get_queryset(self):
        qs = super().get_queryset()
        school_id = resolve_school_id(self.request)
        if school_id:
            qs = qs.filter(**{self.school_field: school_id})
        return qs


class DepartmentViewSet(SchoolScopedViewSet):
    queryset = Department.objects.select_related('school').all()
    serializer_class = DepartmentSerializer
    school_field = 'school_id'

    @action(detail=False, methods=['post'], url_path='seed-defaults')
    def seed_defaults(self, request):
        """Create the initial BDapp IT Firm departments + designations."""
        school_id = resolve_school_id(request, request.data)
        if not school_id:
            return Response({'detail': 'school is required'}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        designation_count = 0
        for name, name_bn, code, des_name, des_name_bn in DEFAULT_DEPARTMENTS:
            dept, created = Department.objects.get_or_create(
                school_id=school_id, name=name,
                defaults={'name_bn': name_bn, 'code': code}
            )
            if created:
                created_count += 1
            _, d_created = Designation.objects.get_or_create(
                school_id=school_id, department=dept, name=des_name,
                defaults={'name_bn': des_name_bn}
            )
            if d_created:
                designation_count += 1

        return Response({
            'detail': 'ok',
            'departments_created': created_count,
            'designations_created': designation_count,
        })


class DesignationViewSet(SchoolScopedViewSet):
    queryset = Designation.objects.select_related('school', 'department').all()
    serializer_class = DesignationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        department_id = self.request.query_params.get('department')
        if department_id:
            qs = qs.filter(department_id=department_id)
        return qs


class EmployeeViewSet(SchoolScopedViewSet):
    queryset = Employee.objects.select_related(
        'school', 'department', 'designation', 'reporting_manager', 'user'
    ).all()
    serializer_class = EmployeeSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        search = params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(name_en__icontains=search) | Q(name_bn__icontains=search) |
                Q(employee_id__icontains=search) | Q(mobile_number__icontains=search) |
                Q(email__icontains=search)
            )

        department = params.get('department')
        if department:
            qs = qs.filter(department_id=department)

        designation = params.get('designation')
        if designation:
            qs = qs.filter(designation_id=designation)

        emp_status = params.get('employment_status')
        if emp_status:
            qs = qs.filter(employment_status=emp_status)

        emp_type = params.get('employment_type')
        if emp_type:
            qs = qs.filter(employment_type=emp_type)

        return qs

    def perform_create(self, serializer):
        school_id = resolve_school_id(self.request, self.request.data)
        serializer.save(school_id=school_id)

    @action(detail=True, methods=['post'], url_path='create-login')
    def create_login(self, request, pk=None):
        """Attach a BDapp login account to this employee."""
        employee = self.get_object()
        if employee.user_id:
            return Response(
                {'detail': 'এই কর্মীর লগইন অ্যাকাউন্ট আগেই তৈরি করা হয়েছে।'},
                status=status.HTTP_400_BAD_REQUEST
            )

        username = (request.data.get('username') or '').strip() or \
            f"emp{employee.employee_id.replace('BD-EMP-', '').strip()}"
        password = (request.data.get('password') or '').strip() or 'bdapp@1234'
        role = (request.data.get('role') or 'teacher').strip()

        if User.objects.filter(username=username).exists():
            return Response(
                {'detail': f'"{username}" ইউজারনেমটি আগেই ব্যবহৃত হয়েছে।'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User(
            username=username,
            first_name=employee.name_en or '',
            first_name_en=employee.name_en or '',
            last_name_en='',
            email=employee.email or '',
            phone_number=employee.mobile_number or '',
        )
        user.set_password(password)
        user.save()

        from users.models import Profile
        Profile.objects.create(
            user=user,
            school=employee.school,
            role=role,
            gender=employee.gender,
            blood_group=employee.blood_group,
            designation=employee.designation.name if employee.designation else '',
            joining_date=employee.joining_date,
        )

        employee.user = user
        employee.save(update_fields=['user'])

        return Response({
            'detail': 'লগইন অ্যাকাউন্ট তৈরি হয়েছে।',
            'user_id': user.id,
            'username': username,
            'password': password,
            'role': role,
        })

    @action(detail=True, methods=['post'], url_path='unlink-login')
    def unlink_login(self, request, pk=None):
        """Detach (but do not delete) the linked login account."""
        employee = self.get_object()
        if not employee.user_id:
            return Response({'detail': 'কোনো লগইন অ্যাকাউন্ট সংযুক্ত নেই।'},
                            status=status.HTTP_400_BAD_REQUEST)
        employee.user = None
        employee.save(update_fields=['user'])
        return Response({'detail': 'লগইন অ্যাকাউন্ট সরানো হয়েছে।'})
