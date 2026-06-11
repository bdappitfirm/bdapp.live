from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import AttendanceRecord
from .serializers import AttendanceRecordSerializer, AttendanceSummarySerializer, MonthlyAttendanceSerializer
from users.permissions import RolePermission, IsSchoolMember
from academics.models import StudentProfile
from datetime import datetime, timedelta
from collections import defaultdict
try:
    from django_filters.rest_framework import DjangoFilterBackend
except Exception:
    DjangoFilterBackend = None

class AttendanceRecordViewSet(viewsets.ModelViewSet):
    queryset = AttendanceRecord.objects.select_related('student__user','student__classroom','student__section','school').all()
    serializer_class = AttendanceRecordSerializer
    permission_classes = [IsSchoolMember, RolePermission]
    filter_backends = [DjangoFilterBackend] if DjangoFilterBackend else []
    filterset_fields = ['school','student','date','taken_by_user']
    
    @action(detail=False, methods=['post'])
    def bulk_save(self, request):
        """Bulk save or update attendance records"""
        records_data = request.data.get('records', [])
        
        if not records_data:
            return Response({'error': 'No records provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        saved_records = []
        errors = []
        
        for record_data in records_data:
            try:
                # Try to get existing record
                existing = AttendanceRecord.objects.filter(
                    student_id=record_data['student'],
                    date=record_data['date']
                ).first()
                
                if existing:
                    # Update existing record
                    existing.present = record_data['present']
                    existing.note = record_data.get('note', '')
                    
                    # Also update who updated it last
                    actor = getattr(request, 'user', None)
                    if actor and hasattr(actor, 'id'):
                        existing.taken_by_user = actor
                        existing.taken_by_name = f"{getattr(actor, 'first_name', '')} {getattr(actor, 'last_name', '')}".strip() or getattr(actor, 'username', '')
                    
                    existing.save()
                    saved_records.append(existing)
                else:
                    # Capture the user who is taking attendance
                    actor = getattr(request, 'user', None)
                    actor_name = ""
                    try:
                        if actor and hasattr(actor, 'id'):
                            # Try to get name from profile if user is a teacher
                            first_name = getattr(actor, 'first_name', '')
                            last_name = getattr(actor, 'last_name', '')
                            actor_name = f"{first_name} {last_name}".strip() or getattr(actor, 'username', '')
                    except Exception:
                        actor_name = ""
                        
                    record = AttendanceRecord.objects.create(
                        school_id=record_data['school'],
                        student_id=record_data['student'],
                        date=record_data['date'],
                        present=record_data['present'],
                        note=record_data.get('note', ''),
                        taken_by_user=actor if actor and getattr(actor, 'id', None) else None,
                        taken_by_name=actor_name or ''
                    )
                    saved_records.append(record)
            except Exception as e:
                errors.append({
                    'student': record_data.get('student'),
                    'error': str(e)
                })
        
        return Response({
            'success': True,
            'saved': len(saved_records),
            'errors': errors
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def daily_summary(self, request):
        """Get attendance summary by date, classroom, and section"""
        school_id = request.query_params.get('school')
        date = request.query_params.get('date')
        
        if not school_id or not date:
            return Response({'error': 'school and date parameters are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get all students grouped by classroom and section
        students = StudentProfile.objects.filter(
            classroom__school_id=school_id
        ).select_related('classroom', 'section')
        
        # Get attendance records for the date
        attendance_records = AttendanceRecord.objects.filter(
            school_id=school_id,
            date=date
        ).select_related('student__classroom', 'student__section')
        
        # Create a map of student attendance
        attendance_map = {record.student_id: record.present for record in attendance_records}
        
        # Group by classroom and section
        summary_data = defaultdict(lambda: {'total': 0, 'present': 0, 'absent': 0})
        
        for student in students:
            classroom_name = student.classroom.name if student.classroom else 'No Class'
            section_name = student.section.name if student.section else 'No Section'
            key = (classroom_name, section_name)
            
            summary_data[key]['total'] += 1
            if student.id in attendance_map:
                if attendance_map[student.id]:
                    summary_data[key]['present'] += 1
                else:
                    summary_data[key]['absent'] += 1
            # If no record, count as absent
            else:
                summary_data[key]['absent'] += 1
        
        # Format the response
        summaries = []
        for (classroom, section), data in summary_data.items():
            percentage = (data['present'] / data['total'] * 100) if data['total'] > 0 else 0
            summaries.append({
                'date': date,
                'classroom': classroom,
                'section': section,
                'total_students': data['total'],
                'present_count': data['present'],
                'absent_count': data['absent'],
                'attendance_percentage': round(percentage, 2)
            })
        
        serializer = AttendanceSummarySerializer(summaries, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def monthly_report(self, request):
        """Get monthly attendance report for students"""
        school_id = request.query_params.get('school')
        month = request.query_params.get('month')  # Format: YYYY-MM
        classroom_id = request.query_params.get('classroom')
        section_id = request.query_params.get('section')
        
        if not school_id or not month:
            return Response({'error': 'school and month parameters are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            year, month_num = map(int, month.split('-'))
            start_date = datetime(year, month_num, 1).date()
            if month_num == 12:
                end_date = datetime(year + 1, 1, 1).date()
            else:
                end_date = datetime(year, month_num + 1, 1).date()
        except ValueError:
            return Response({'error': 'Invalid month format. Use YYYY-MM'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Filter students
        students_query = StudentProfile.objects.filter(classroom__school_id=school_id)
        if classroom_id:
            students_query = students_query.filter(classroom_id=classroom_id)
        if section_id:
            students_query = students_query.filter(section_id=section_id)
        
        students = students_query.select_related('user', 'classroom', 'section')
        
        # Get student IDs for filtering attendance records
        student_ids = list(students.values_list('id', flat=True))
        
        # Get attendance records for the month
        attendance_records = AttendanceRecord.objects.filter(
            school_id=school_id,
            student_id__in=student_ids,
            date__gte=start_date,
            date__lt=end_date
        )
        
        # Create attendance map
        attendance_map = defaultdict(lambda: {'present': 0, 'absent': 0})
        # Also map per-day status for quick lookup
        per_day_map = defaultdict(dict)  # student_id -> { 'YYYY-MM-DD': 'present'|'absent' }
        for record in attendance_records:
            student_id = record.student_id
            day_str = record.date.strftime('%Y-%m-%d')
            if record.present:
                attendance_map[student_id]['present'] += 1
                per_day_map[student_id][day_str] = 'present'
            else:
                attendance_map[student_id]['absent'] += 1
                per_day_map[student_id][day_str] = 'absent'
        
        # Calculate working days (exclude Fri/Sat and basic holidays)
        working_days = []
        # Basic holiday list (could be moved to a model)
        govt_holidays = [
            '02-21', # Shaheed Day
            '03-17', # Sheikh Mujib's Birthday
            '03-26', # Independence Day
            '04-14', # Bengali New Year
            '05-01', # May Day
            '12-16', # Victory Day
        ]
        
        total_days_in_month = (end_date - start_date).days
        for i in range(total_days_in_month):
            day = (start_date + timedelta(days=i))
            # 4=Friday, 5=Saturday in some systems, but Python's weekday() is 0=Mon...4=Fri, 5=Sat, 6=Sun
            # So Friday=4, Saturday=5
            if day.weekday() in [4, 5]: # Friday and Saturday
                continue
            if day.strftime('%m-%d') in govt_holidays:
                continue
            working_days.append(day)
            
        total_working_days = len(working_days)
        
        # Format response
        reports = []
        for student in students:
            details = []
            present_count = 0
            for day in working_days:
                day_str = day.strftime('%Y-%m-%d')
                status = per_day_map[student.id].get(day_str, 'absent')
                if status == 'present':
                    present_count += 1
                details.append({
                    'date': day_str,
                    'status': status
                })
            
            absent_count = total_working_days - present_count
            percentage = (present_count / total_working_days * 100) if total_working_days > 0 else 0
            
            reports.append({
                'student_id': student.id,
                'student_name': f"{student.user.first_name} {student.user.last_name}".strip() or student.user.username,
                'classroom': student.classroom.name if student.classroom else 'N/A',
                'section': student.section.name if student.section else 'N/A',
                'roll_number': student.roll_number or '',
                'total_days': total_working_days,
                'present_days': present_count,
                'absent_days': absent_count,
                'attendance_percentage': round(percentage, 2),
                'attendance_details': details
            })
        
        serializer = MonthlyAttendanceSerializer(reports, many=True)
        return Response(serializer.data)
