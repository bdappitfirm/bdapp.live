from rest_framework import viewsets, filters, status, pagination
from rest_framework.decorators import action
from rest_framework.response import Response
from users.permissions import (
    AdminOrReadOnly, RolePermission, SubjectResultWritePermission,
    IsSchoolMember, TeacherSubjectResultPermission, is_effective_admin,
    is_global_admin, get_user_school_id
)
from rest_framework.permissions import IsAuthenticated
from .models import Examination, Result, StudentOverallResult, ExamSlot
from .serializers import ExaminationSerializer, ResultSerializer, StudentOverallResultSerializer, ExamSlotSerializer
from django.db.models import Q
from datetime import datetime
import math

class ExamSlotViewSet(viewsets.ModelViewSet):
    queryset = ExamSlot.objects.all()
    serializer_class = ExamSlotSerializer
    permission_classes = [IsSchoolMember, IsAuthenticated, RolePermission]
    def get_queryset(self):
        sid = get_user_school_id(self.request.user, self.request)
        if not sid:
            if is_global_admin(self.request.user):
                return ExamSlot.objects.all().select_related('examination', 'subject', 'classroom', 'section')
            return ExamSlot.objects.none()

        # Global admin viewing everything
        if is_global_admin(self.request.user) and not sid:
            return ExamSlot.objects.all().select_related('examination', 'subject', 'classroom', 'section')

        qs = ExamSlot.objects.filter(school_id=sid).select_related('examination', 'subject', 'classroom', 'section')
        eid = self.request.query_params.get('examination')
        if eid: qs = qs.filter(examination_id=eid)
        return qs

class ExaminationViewSet(viewsets.ModelViewSet):
    queryset = Examination.objects.all()
    serializer_class = ExaminationSerializer
    permission_classes = [IsSchoolMember, IsAuthenticated, RolePermission]
    def get_queryset(self):
        sid = get_user_school_id(self.request.user, self.request)
        if not sid:
            if is_global_admin(self.request.user):
                return Examination.objects.all().select_related('classroom', 'section').prefetch_related('slots')
            return Examination.objects.none()

        # Global admin viewing everything
        if is_global_admin(self.request.user) and not sid:
            qs = Examination.objects.all().select_related('classroom', 'section').prefetch_related('slots')
        else:
            qs = Examination.objects.filter(school_id=sid).select_related('classroom', 'section').prefetch_related('slots')

        cid = self.request.query_params.get('classroom')
        if cid: qs = qs.filter(classroom_id=cid)

        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(Q(year=year) | Q(exam_date__year=year))

        return qs

    @action(detail=True, methods=['post'])
    def bulk_results(self, request, pk=None):
        examination = self.get_object()
        results_data = request.data.get('results', [])

        from django.db import transaction
        from decimal import Decimal

        created = 0
        updated = 0
        errors = []

        for r_data in results_data:
            try:
                with transaction.atomic():
                    # Handle both student_id/subject_id and student/subject keys
                    student_id = r_data.get('student_id') or r_data.get('student')
                    subject_id = r_data.get('subject_id') or r_data.get('subject')

                    if not student_id or not subject_id:
                        errors.append({"error": "Missing student or subject ID", "data": r_data})
                        continue

                    obj, created_now = Result.objects.update_or_create(
                        examination=examination,
                        student_id=int(student_id),
                        subject_id=int(subject_id),
                        defaults={
                            'written_marks': Decimal(str(r_data.get('written_marks') or 0)),
                            'mcq_marks': Decimal(str(r_data.get('mcq_marks') or 0)),
                            'practical_marks': Decimal(str(r_data.get('practical_marks') or 0)),
                            'remarks': r_data.get('remarks', '')
                        }
                    )
                    if created_now:
                        created += 1
                    else:
                        updated += 1
            except Exception as e:
                errors.append({"error": str(e), "student_id": r_data.get('student_id') or r_data.get('student')})

        return Response({
            "created": created,
            "updated": updated,
            "errors": errors
        }, status=status.HTTP_200_OK if (created or updated or not errors) else status.HTTP_400_BAD_REQUEST)

class ResultViewSet(viewsets.ModelViewSet):
    queryset = Result.objects.all()
    serializer_class = ResultSerializer
    permission_classes = [IsSchoolMember, IsAuthenticated, SubjectResultWritePermission]
    def get_queryset(self):
        sid = get_user_school_id(self.request.user, self.request)
        if not sid:
            if is_global_admin(self.request.user):
                return Result.objects.all().select_related('examination', 'student__user', 'subject')
            return Result.objects.none()

        # Start with results for the current school (or all for global admin)
        if is_global_admin(self.request.user) and not sid:
            qs = Result.objects.all().select_related('examination', 'student__user', 'subject')
        else:
            qs = Result.objects.filter(examination__school_id=sid).select_related('examination', 'student__user', 'subject')

        # Strict filtering based on query parameters to prevent data leakage
        eid = self.request.query_params.get('examination')
        if eid:
            qs = qs.filter(examination_id=eid)

        section_id = self.request.query_params.get('section')
        if section_id:
            if section_id == 'null':
                qs = qs.filter(student__section__isnull=True)
            elif ',' in section_id:
                ids = [s.strip() for s in section_id.split(',') if s.strip().isdigit()]
                if ids: qs = qs.filter(student__section_id__in=ids)
            elif section_id.isdigit():
                qs = qs.filter(student__section_id=int(section_id))

        student_id = self.request.query_params.get('student')
        if student_id:
            qs = qs.filter(student_id=student_id)

        classroom_id = self.request.query_params.get('classroom')
        if classroom_id:
            qs = qs.filter(examination__classroom_id=classroom_id)

        subject_id = self.request.query_params.get('subject')
        if subject_id:
            qs = qs.filter(subject_id=subject_id)

        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(Q(examination__year=year) | Q(examination__exam_date__year=year))

        return qs

class StudentOverallResultViewSet(viewsets.ModelViewSet):
    queryset = StudentOverallResult.objects.all()
    serializer_class = StudentOverallResultSerializer
    permission_classes = [IsSchoolMember, IsAuthenticated, RolePermission]
    def get_queryset(self):
        sid = get_user_school_id(self.request.user, self.request)
        if not sid:
            if is_global_admin(self.request.user):
                return StudentOverallResult.objects.all().select_related('examination', 'student__user')
            return StudentOverallResult.objects.none()

        # Global admin viewing everything
        if is_global_admin(self.request.user) and not sid:
            qs = StudentOverallResult.objects.all().select_related('examination', 'student__user')
        else:
            qs = StudentOverallResult.objects.filter(examination__school_id=sid).select_related('examination', 'student__user')

        eid = self.request.query_params.get('examination')
        if eid: qs = qs.filter(examination_id=eid)
        return qs

    @action(detail=False, methods=['get'])
    def combined_by_exam_type(self, request):
        student_id = request.query_params.get('student')
        exam_type = request.query_params.get('exam_type')
        year = request.query_params.get('year')

        if not student_id or not exam_type:
            return Response({"detail": "Missing parameters"}, status=400)

        qs = StudentOverallResult.objects.filter(
            student_id=student_id,
            examination__exam_type=exam_type
        )
        if year:
            qs = qs.filter(Q(examination__year=year) | Q(examination__exam_date__year=year))

        res = qs.first()
        if not res:
            return Response({"detail": "Not found"}, status=404)

        serializer = self.get_serializer(res)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def combined_rank_list_by_exam_type(self, request):
        exam_type = request.query_params.get('exam_type')
        classroom_id = request.query_params.get('classroom')
        section_id = request.query_params.get('section')
        year = request.query_params.get('year')
        sid = get_user_school_id(request.user, request)

        if not exam_type or not classroom_id:
            return Response({"detail": "Missing parameters"}, status=400)

        qs = StudentOverallResult.objects.filter(
            examination__school_id=sid,
            examination__exam_type=exam_type,
            examination__classroom_id=classroom_id
        )

        if section_id:
            qs = qs.filter(student__section_id=section_id)
        if year:
             qs = qs.filter(Q(examination__year=year) | Q(examination__exam_date__year=year))

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def dashboard_result_summary(self, request):
        try:
            sid = get_user_school_id(request.user, request)
            if not sid: return Response([])
            
            # Get ALL exams for the school, sorted by latest first (exam_date desc, then id desc)
            exams = Examination.objects.filter(school_id=sid).order_by('-exam_date', '-id')
            if not exams.exists():
                return Response([])
            
            # Get the LATEST exam
            latest_exam = exams.first()
            exam_ids = [latest_exam.id]
            
            # Get all results for this exam
            results = Result.objects.filter(examination_id__in=exam_ids).select_related(
                'subject', 'examination', 
                'student__classroom', 'student'
            )
            
            # Get ALL students for this school (to calculate total, absent etc)
            from academics.models import StudentProfile
            all_students = StudentProfile.objects.filter(school_id=sid).select_related('classroom')
            
            # First, group results by student to get per-student data
            student_results = {}
            for r in results:
                if not r.student_id:
                    continue
                if r.student_id not in student_results:
                    student_results[r.student_id] = {
                        'student': r.student,
                        'results': [],
                        'failed_count': 0
                    }
                student_results[r.student_id]['results'].append(r)
                if not r.is_passed:
                    student_results[r.student_id]['failed_count'] += 1
            
            # Now build summary per classroom
            summary = {}
            for student in all_students:
                if not student.classroom:
                    continue
                c_name = student.classroom.name
                if c_name not in summary:
                    # Initialize with all the required fields
                    summary[c_name] = {
                        'class_name': c_name,
                        'total': 0,
                        'absent': 0,
                        'passed': 0,
                        'failed_1': 0,
                        'failed_2': 0,
                        'failed_3': 0,
                        'failed_4': 0,
                        'failed_5': 0,
                        'failed_6': 0,
                        'failed_7': 0,
                        'failed_8': 0,
                        'failed_9': 0,
                        'failed_10': 0,
                        'failed_10_plus': 0
                    }
                
                summary[c_name]['total'] += 1
                
                if student.id not in student_results:
                    # No results: absent
                    summary[c_name]['absent'] += 1
                else:
                    # Has results: check pass/fail and failed count
                    student_data = student_results[student.id]
                    if student_data['failed_count'] == 0:
                        summary[c_name]['passed'] += 1
                    else:
                        # Count failed count
                        failed_count = student_data['failed_count']
                        if failed_count <= 10:
                            summary[c_name][f'failed_{failed_count}'] += 1
                        else:
                            summary[c_name]['failed_10_plus'] += 1
            
            # Convert to list
            return Response(list(summary.values()))
        except Exception as e:
            print(f"Error generating dashboard result summary: {e}")
            return Response([])
