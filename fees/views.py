from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from .models import FeeStructure, Payment, FeeCategory, StudentFeeAssignment, FeeCollection, FeeSlip
from academics.models import StudentProfile
from django.db import transaction
from .serializers import (
    FeeStructureSerializer, PaymentSerializer,
    FeeCategorySerializer, StudentFeeAssignmentSerializer, FeeCollectionSerializer, FeeSlipSerializer
)
from users.permissions import AdminOrReadOnly, IsSchoolMember, get_user_school_id, is_global_admin

class FeeStructureViewSet(viewsets.ModelViewSet):
    queryset = FeeStructure.objects.select_related('school','classroom','category').all()
    serializer_class = FeeStructureSerializer
    permission_classes = [IsSchoolMember, AdminOrReadOnly]
    filter_backends = []

    def get_queryset(self):
        qs = super().get_queryset()
        school = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        classroom = (
            self.request.query_params.get('classroom')
            or self.request.query_params.get('classroom_id')
            or self.request.query_params.get('class_id')
        )
        if school:
            qs = qs.filter(school_id=school)
        if classroom:
            qs = qs.filter(classroom_id=classroom)
        return qs

    @action(detail=False, methods=['post'])
    def bulk_setup(self, request):
        """Setup or update multiple fee structures for a class at once"""
        school_id = request.data.get('school_id')
        classroom_id = request.data.get('classroom_id')
        structures_data = request.data.get('structures', [])

        if not school_id or not classroom_id:
            return Response({'error': 'school_id and classroom_id are required'}, status=400)

        created_count = 0
        updated_count = 0

        with transaction.atomic():
            for data in structures_data:
                name = data.get('name')
                freq = data.get('frequency', 'monthly')
                month = data.get('month')
                amount = data.get('amount', 0)

                # Try to find existing structure to update
                existing = None
                if freq == 'monthly' and month:
                    existing = FeeStructure.objects.filter(
                        school_id=school_id, classroom_id=classroom_id,
                        frequency='monthly', month=month
                    ).first()
                else:
                    # For one-time fees, match by name
                    existing = FeeStructure.objects.filter(
                        school_id=school_id, classroom_id=classroom_id,
                        frequency='one_time', name__iexact=name
                    ).first()

                if existing:
                    existing.amount = amount
                    existing.name = name
                    existing.save()
                    updated_count += 1
                else:
                    FeeStructure.objects.create(
                        school_id=school_id, classroom_id=classroom_id,
                        name=name, frequency=freq, month=month, amount=amount,
                        academic_year=data.get('academic_year', '2026'),
                        is_active=True
                    )
                    created_count += 1

        return Response({
            'success': True,
            'created': created_count,
            'updated': updated_count
        })

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('student__user','fee_assignment').all()
    serializer_class = PaymentSerializer
    permission_classes = [IsSchoolMember, AdminOrReadOnly]
    filter_backends = []

    def get_queryset(self):
        qs = super().get_queryset()
        school = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        student = self.request.query_params.get('student') or self.request.query_params.get('student_id')
        status_filter = self.request.query_params.get('status')
        if not school:
            school = get_user_school_id(self.request.user, self.request)
        if school:
            qs = qs.filter(student__school_id=school)
        elif not is_global_admin(self.request.user):
            return Payment.objects.none()
        if student:
            qs = qs.filter(student_id=student)
        if status_filter:
            qs = qs.filter(payment_status=status_filter)
        return qs


class FeeCategoryViewSet(viewsets.ModelViewSet):
    queryset = FeeCategory.objects.select_related('school').all()
    serializer_class = FeeCategorySerializer
    permission_classes = [IsSchoolMember, AdminOrReadOnly]
    filter_backends = []

    def get_queryset(self):
        qs = super().get_queryset()
        school = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        if not school:
            school = get_user_school_id(self.request.user, self.request)
        if school:
            qs = qs.filter(school_id=school)
        elif not is_global_admin(self.request.user):
            return FeeCategory.objects.none()
        return qs


class StudentFeeAssignmentViewSet(viewsets.ModelViewSet):
    queryset = StudentFeeAssignment.objects.select_related('student__user','student__classroom','fee_structure__category','fee_structure__classroom','fee_structure__school').all()
    serializer_class = StudentFeeAssignmentSerializer
    permission_classes = [IsSchoolMember, AdminOrReadOnly]
    filter_backends = []

    def get_queryset(self):
        qs = super().get_queryset()
        school = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        student = self.request.query_params.get('student') or self.request.query_params.get('student_id')
        fee_structure = self.request.query_params.get('fee_structure') or self.request.query_params.get('fee_structure_id')
        classroom = (
            self.request.query_params.get('classroom')
            or self.request.query_params.get('classroom_id')
            or self.request.query_params.get('class_id')
        )
        if school:
            qs = qs.filter(fee_structure__school_id=school)
        if classroom:
            qs = qs.filter(fee_structure__classroom_id=classroom)
        if student:
            qs = qs.filter(student_id=student)
        if fee_structure:
            qs = qs.filter(fee_structure_id=fee_structure)
        return qs

    def perform_create(self, serializer):
        instance = serializer.validated_data
        student = instance.get('student')
        fs = instance.get('fee_structure')
        if student and fs:
            s_cls = getattr(student, 'classroom', None)
            f_cls = getattr(fs, 'classroom', None)
            if s_cls and f_cls and s_cls.pk != f_cls.pk:
                raise ValidationError({'fee_structure_id': 'Fee structure classroom does not match the student\'s classroom.'})
            s_school = getattr(student, 'school', None) or getattr(getattr(s_cls, 'school', None), 'pk', None)
            f_school = getattr(fs, 'school', None)
            if s_school and f_school and getattr(s_school, 'pk', s_school) != getattr(f_school, 'pk', f_school):
                raise ValidationError({'fee_structure_id': 'Fee structure school does not match the student\'s school.'})
        serializer.save()

    @action(detail=False, methods=['post'])
    def bulk_assign(self, request):
        """Assign all current fee structures for a class to all students in that class"""
        classroom_id = request.data.get('classroom_id')
        school_id = request.data.get('school_id')

        if not classroom_id or not school_id:
            return Response({'error': 'classroom_id and school_id are required'}, status=400)

        # 1. Get all students in this class
        students = StudentProfile.objects.filter(school_id=school_id, classroom_id=classroom_id)

        # 2. Get all active fee structures for this class
        structures = FeeStructure.objects.filter(school_id=school_id, classroom_id=classroom_id, is_active=True)

        if not students.exists() or not structures.exists():
            return Response({'message': 'No students or structures found to assign'}, status=200)

        created_count = 0

        with transaction.atomic():
            for student in students:
                for structure in structures:
                    # Avoid duplicates
                    obj, created = StudentFeeAssignment.objects.get_or_create(
                        student=student,
                        fee_structure=structure,
                        defaults={
                            'amount': structure.amount,
                            'due_date': request.data.get('due_date', '2026-11-01'),
                            'status': 'unpaid'
                        }
                    )
                    if created:
                        created_count += 1

        return Response({
            'success': True,
            'assigned': created_count,
            'students_processed': students.count()
        })


class FeeCollectionViewSet(viewsets.ModelViewSet):
    queryset = FeeCollection.objects.select_related('school','classroom').all()
    serializer_class = FeeCollectionSerializer
    permission_classes = [IsSchoolMember, AdminOrReadOnly]
    filter_backends = []

    def get_queryset(self):
        qs = super().get_queryset()
        school = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        classroom = (
            self.request.query_params.get('classroom')
            or self.request.query_params.get('classroom_id')
            or self.request.query_params.get('class_id')
        )
        if not school:
            school = get_user_school_id(self.request.user, self.request)
        if school:
            qs = qs.filter(school_id=school)
        elif not is_global_admin(self.request.user):
            return FeeCollection.objects.none()
        if classroom:
            qs = qs.filter(classroom_id=classroom)
        return qs


class FeeSlipViewSet(viewsets.ModelViewSet):
    queryset = FeeSlip.objects.select_related('school','classroom','student__user','fee_structure').all()
    serializer_class = FeeSlipSerializer
    permission_classes = [IsSchoolMember, AdminOrReadOnly]
    filter_backends = []

    def get_queryset(self):
        qs = super().get_queryset()
        school = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        classroom = (
            self.request.query_params.get('classroom')
            or self.request.query_params.get('classroom_id')
            or self.request.query_params.get('class_id')
        )
        student = self.request.query_params.get('student') or self.request.query_params.get('student_id')
        fs = self.request.query_params.get('fee_structure') or self.request.query_params.get('fee_structure_id')
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        if school:
            qs = qs.filter(school_id=school)
        if classroom:
            qs = qs.filter(classroom_id=classroom)
        if student:
            qs = qs.filter(student_id=student)
        if fs:
            qs = qs.filter(fee_structure_id=fs)
        if month:
            qs = qs.filter(month=month)
        if year:
            qs = qs.filter(year=year)
        return qs
