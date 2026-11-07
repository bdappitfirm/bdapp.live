import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import StudentAttendanceSummary
from .serializers import StudentAttendanceSummarySerializer
from users.permissions import IsSchoolMember, get_user_school_id
from academics.models import StudentProfile
from backend.cache_utils import CachedListMixin

logger = logging.getLogger(__name__)

class AttendanceSummaryViewSet(CachedListMixin, viewsets.ModelViewSet):
    permission_classes = [IsSchoolMember]
    queryset = StudentAttendanceSummary.objects.all()
    serializer_class = StudentAttendanceSummarySerializer
    pagination_class = None
    cache_prefix = 'attendance-summaries-list'

    def get_queryset(self):
        sid = get_user_school_id(self.request.user, self.request)
        if not sid or sid == "GLOBAL":
             # If superuser or global, try to get from query params
             sid = self.request.query_params.get('school_id') or self.request.query_params.get('school')

        if not sid:
            return StudentAttendanceSummary.objects.none()

        qs = StudentAttendanceSummary.objects.filter(school_id=sid)
        student_id = self.request.query_params.get('student')
        year = self.request.query_params.get('year')

        if student_id:
            qs = qs.filter(student_id=student_id)
        if year:
            qs = qs.filter(year=year)
        return qs

    @action(detail=False, methods=['get'])
    def get_by_section(self, request):
        try:
            school_id = get_user_school_id(request.user, request)
            if not school_id or school_id == "GLOBAL":
                school_id = request.query_params.get('school_id') or request.query_params.get('school')

            classroom_id = request.query_params.get('classroom')
            section_id = request.query_params.get('section')
            year = request.query_params.get('year')

            if not classroom_id or not year or not school_id:
                return Response({'error': 'School, Classroom and Year are required'}, status=400)

            students = StudentProfile.objects.filter(school_id=school_id, classroom_id=classroom_id)
            if section_id and section_id != 'null' and section_id != '' and section_id != 'undefined':
                students = students.filter(section_id=section_id)

            students_list = list(students)
            students_list.sort(key=lambda s: (int(''.join(filter(str.isdigit, str(s.roll_number or '0'))) or 0), str(s.roll_number or '')))

            summaries = StudentAttendanceSummary.objects.filter(student__in=students_list, year=year)
            summary_map = {s.student_id: s for s in summaries}

            result = []
            for s in students_list:
                summary = summary_map.get(s.id)
                result.append({
                    'student_id': s.id,
                    'name': f"{s.user.first_name} {s.user.last_name}".strip() or s.user.username,
                    'roll': s.roll_number,
                    'summary': {
                        'monthly_data': summary.monthly_data if summary else {},
                        'total_present': summary.total_present if summary else 0,
                        'total_absent': summary.total_absent if summary else 0,
                    }
                })
            return Response(result)
        except Exception as e:
            logger.exception("Error in get_by_section")
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['post'])
    def bulk_save(self, request):
        try:
            school_id = get_user_school_id(request.user, request)
            if not school_id or school_id == "GLOBAL":
                school_id = request.data.get('school_id')

            if not school_id:
                return Response({'error': 'School ID is required'}, status=400)

            data = request.data.get('records', [])
            year = request.data.get('year')

            with transaction.atomic():
                for record in data:
                    student_id = record.get('student_id')
                    if not student_id: continue

                    StudentAttendanceSummary.objects.update_or_create(
                        student_id=student_id,
                        year=year,
                        defaults={
                            'school_id': school_id,
                            'monthly_data': record.get('monthly_data', {}),
                            'total_present': int(record.get('total_present', 0)),
                            'total_absent': int(record.get('total_absent', 0))
                        }
                    )
            return Response({'success': True})
        except Exception as e:
            logger.exception("Error in bulk_save")
            return Response({'error': str(e)}, status=500)
