import logging
import traceback
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction, connection
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
                'employee',
                'employee__designation',
                'employee__department',
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
            if p.get('employee'): qs = qs.filter(employee_id=p.get('employee'))
            if str(p.get('staff', '')).lower() in ('1', 'true', 'yes'): qs = qs.filter(employee__isnull=False)
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

            with transaction.atomic():
                with connection.cursor() as cursor:
                    # Ensure employee column exists in attendance_attendancerecord if needed
                    try:
                        cursor.execute("ALTER TABLE attendance_attendancerecord ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES employees_employee(id) ON DELETE CASCADE;")
                    except Exception:
                        pass

                    for rd in records_data:
                        student_id = rd.get('student')
                        employee_id = rd.get('employee')
                        date_val = rd.get('date')
                        present = bool(rd.get('present', True))
                        note = str(rd.get('note', ''))
                        device_id = rd.get('device_id')
                        scan_time = rd.get('scan_time')
                        session = rd.get('session')

                        if not date_val or (not student_id and not employee_id):
                            continue

                        if student_id:
                            cursor.execute("""
                                INSERT INTO attendance_attendancerecord
                                (school_id, student_id, date, present, note, taken_by_user_id, taken_by_name, device_id, scan_time, session)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON CONFLICT (student_id, date)
                                DO UPDATE SET present = EXCLUDED.present, note = EXCLUDED.note, device_id = EXCLUDED.device_id, scan_time = EXCLUDED.scan_time
                            """, [sid, student_id, date_val, present, note, user_id, user_name, device_id, scan_time, session])
                        elif employee_id:
                            cursor.execute("""
                                INSERT INTO attendance_attendancerecord
                                (school_id, employee_id, date, present, note, taken_by_user_id, taken_by_name, device_id, scan_time, session)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON CONFLICT (employee_id, date)
                                DO UPDATE SET present = EXCLUDED.present, note = EXCLUDED.note, device_id = EXCLUDED.device_id, scan_time = EXCLUDED.scan_time
                            """, [sid, employee_id, date_val, present, note, user_id, user_name, device_id, scan_time, session])

            return Response({
                'success': True,
                'total': len(records_data),
                'message': f'Successfully saved {len(records_data)} attendance records'
            })
        except Exception as e:
            logger.exception("Error in bulk_save")
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=['get'])
    def monthly_report(self, request):
        try:
            sid = get_user_school_id(request.user, request)
            if not sid: return Response({'error': 'Unauthorized'}, status=401)

            params = request.query_params
            month_str = params.get('month')  # YYYY-MM
            year_str = params.get('year')    # YYYY
            is_employee = str(params.get('employee', '')).lower() in ('1', 'true', 'yes')

            # ---------- EMPLOYEE (STAFF) REPORT ----------
            if is_employee:
                qs = AttendanceRecord.objects.filter(school_id=sid, employee__isnull=False)
                if year_str:
                    try:
                        qs = qs.filter(date__year=int(year_str))
                    except (TypeError, ValueError):
                        return Response([])
                else:
                    if not month_str:
                        from django.utils import timezone
                        month_str = timezone.now().strftime('%Y-%m')
                    try:
                        year, month = map(int, month_str.split('-'))
                        qs = qs.filter(date__year=year, date__month=month)
                    except (TypeError, ValueError):
                        qs = qs.filter(date__startswith=month_str)

                dept_id = params.get('department')
                if dept_id:
                    qs = qs.filter(employee__department_id=dept_id)
                emp_id = params.get('employee_id')
                if emp_id:
                    qs = qs.filter(employee_id=emp_id)

                rows = qs.values(
                    'employee_id', 'date', 'present',
                    'employee__name_en', 'employee__name_bn', 'employee__employee_id',
                    'employee__designation__name', 'employee__department__name'
                )

                emp_report = {}
                for item in rows:
                    eid = item['employee_id']
                    if eid not in emp_report:
                        emp_report[eid] = {
                            'employee_id': eid,
                            'name': item['employee__name_en'] or item['employee__name_bn'] or 'Employee',
                            'roll': item['employee__employee_id'],
                            'designation': item['employee__designation__name'],
                            'department': item['employee__department__name'],
                            'attendance': {}
                        }
                    emp_report[eid]['attendance'][str(item['date'])] = item['present']

                return Response(sorted(emp_report.values(), key=lambda x: str(x['roll'] or '')))

            # ---------- STUDENT REPORT ----------
            cid = params.get('classroom')
            secid = params.get('section')
            student_id = params.get('student')

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
