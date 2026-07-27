import logging
import traceback
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import AttendanceRecord
from .serializers import AttendanceRecordSerializer
from users.permissions import RolePermission, IsSchoolMember, get_user_school_id
from academics.models import StudentProfile
from academics.views import StandardResultsSetPagination

logger = logging.getLogger(__name__)

class AttendanceRecordViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsSchoolMember, RolePermission]
    queryset = AttendanceRecord.objects.all()
    filter_backends = []
    pagination_class = StandardResultsSetPagination

    def list(self, request, *args, **kwargs):
        try:
            logger.info(f"Attendance list requested by {request.user}")
            queryset = self.get_queryset()

            # Use pagination manually
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.exception("CRITICAL: AttendanceRecordViewSet.list failed")
            # If it's a pagination error or something similar, it might still reach here
            return Response({
                "error": "Internal Server Error in list view",
                "detail": str(e)
            }, status=500)

    def get_queryset(self):
        try:
            sid = get_user_school_id(self.request.user, self.request)
            if not sid:
                return AttendanceRecord.objects.none()

            # 1. Detect actual columns in DB
            from django.db import connection
            with connection.cursor() as cursor:
                db_cols = {c.name for c in connection.introspection.get_table_description(cursor, 'attendance_attendancerecord')}

            # 2. Identify fields to exclude (those in model but not in DB)
            model_fields = {'device_id', 'scan_time', 'session', 'operator_log', 'created_at'}
            to_defer = [f for f in model_fields if f not in db_cols]

            # 3. Build safe queryset
            if sid == "GLOBAL":
                qs = AttendanceRecord.objects.all()
            else:
                qs = AttendanceRecord.objects.filter(school_id=sid)
            if to_defer:
                qs = qs.defer(*to_defer)

            qs = qs.select_related(
                'student__user',
                'student__classroom',
                'student__section',
                'taken_by_user'
            )

            # Intelligent sorting: by date (newest first), then by student roll number numerically
            try:
                from django.db.models.functions import Cast, RegExpReplace
                from django.db.models import IntegerField

                qs = qs.annotate(
                    roll_digits=RegExpReplace('student__roll_number', r'\D', '', flags='g')
                ).annotate(
                    roll_int=Cast('roll_digits', output_field=IntegerField())
                ).order_by('-date', 'roll_int', 'student__roll_number')
            except (ImportError, Exception):
                # Fallback to standard sorting if regex/cast fails
                qs = qs.order_by('-date', 'student__roll_number')

            # Filtering
            p = self.request.query_params
            if p.get('date'): qs = qs.filter(date=p.get('date'))
            if p.get('student'): qs = qs.filter(student_id=p.get('student'))
            if p.get('classroom'): qs = qs.filter(student__classroom_id=p.get('classroom'))
            if p.get('section'): qs = qs.filter(student__section_id=p.get('section'))

            return qs
        except Exception as e:
            logger.exception("Error in get_queryset")
            return AttendanceRecord.objects.none()

    @action(detail=False, methods=['post'])
    def bulk_save(self, request):
        try:
            sid = get_user_school_id(request.user, request)
            records_data = request.data.get('records', [])
            if not sid and records_data:
                sid = records_data[0].get('school')
            if not sid:
                 return Response({'error': 'School ID missing'}, status=401)

            user_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else 'System'
            user_id = request.user.id if request.user.is_authenticated else None

            # 1. Detect actual columns in DB using robust Django introspection
            from django.db import connection
            with connection.cursor() as cursor:
                db_cols = {c.name for c in connection.introspection.get_table_description(cursor, 'attendance_attendancerecord')}

            # 2. Separate present/missing fields
            optional_fields = ['device_id', 'scan_time', 'session']
            available_optional = [f for f in optional_fields if f in db_cols]

            # 3. Build Raw SQL for maximum reliability when schema is out of sync
            # This avoids Django ORM's tendency to include all model fields in INSERTs
            base_cols = ['student_id', 'date', 'school_id', 'present', 'note', 'taken_by_user_id', 'taken_by_name']
            all_cols = base_cols + available_optional

            placeholders = ", ".join(["%s"] * len(all_cols))
            col_names = ", ".join([f'"{c}"' for c in all_cols])

            # Update part for ON CONFLICT
            update_parts = [f'"{c}" = EXCLUDED."{c}"' for c in all_cols if c not in ['student_id', 'date']]
            update_stmt = ", ".join(update_parts)

            sql = f"""
                INSERT INTO attendance_attendancerecord ({col_names})
                VALUES ({placeholders})
                ON CONFLICT (student_id, date)
                DO UPDATE SET {update_stmt}
            """

            # Prepare data for batch execution
            batch_data = []
            for rd in records_data:
                student_id = rd.get('student')
                date_val = rd.get('date')
                if not student_id or not date_val: continue

                row = [
                    student_id, date_val, sid,
                    bool(rd.get('present', True)),
                    str(rd.get('note', '')),
                    user_id, user_name
                ]
                # Append extra fields if they exist in DB
                for f in available_optional:
                    row.append(rd.get(f))
                batch_data.append(row)

            if batch_data:
                with transaction.atomic():
                    with connection.cursor() as cursor:
                        cursor.executemany(sql, batch_data)

            return Response({
                'success': True,
                'total': len(batch_data),
                'message': f'Successfully saved {len(batch_data)} records (Database-safe mode)'
            })
        except Exception as e:
            logger.exception("Error in bulk_save")
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=['get'])
    def monthly_report(self, request):
        try:
            sid = get_user_school_id(request.user, request)
            if not sid: return Response({'error': 'Unauthorized'}, status=401)

            cid = request.query_params.get('classroom')
            secid = request.query_params.get('section')
            month_str = request.query_params.get('month') # YYYY-MM
            student_id = request.query_params.get('student')

            if not month_str:
                from django.utils import timezone
                month_str = timezone.now().strftime('%Y-%m')

            # Correct DateField filtering
            try:
                year, month = map(int, month_str.split('-'))
                qs = AttendanceRecord.objects.filter(school_id=sid, date__year=year, date__month=month)
            except:
                qs = AttendanceRecord.objects.filter(school_id=sid, date__startswith=month_str)

            if student_id:
                qs = qs.filter(student_id=student_id)
            elif cid:
                qs = qs.filter(student__classroom_id=cid)
                if secid:
                    qs = qs.filter(student__section_id=secid)

            data = qs.values('student_id', 'date', 'present', 'student__user__first_name', 'student__user__last_name', 'student__roll_number')

            report = {}
            for item in data:
                stu_id = item['student_id']
                if stu_id not in report:
                    report[stu_id] = {
                        'student_id': stu_id,
                        'name': f"{item['student__user__first_name']} {item['student__user__last_name']}".strip(),
                        'roll': item['student__roll_number'],
                        'attendance': {}
                    }
                report[stu_id]['attendance'][str(item['date'])] = item['present']

            # Sort the report by roll number numerically
            sorted_report = sorted(
                report.values(),
                key=lambda x: (int(''.join(filter(str.isdigit, str(x['roll'] or '0'))) or 0), str(x['roll'] or ''))
            )
            return Response(sorted_report)
        except Exception as e:
            logger.exception("Error in monthly_report")
            return Response({"error": str(e)}, status=500)
