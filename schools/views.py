from rest_framework import viewsets, permissions, status
from users.permissions import AdminOrReadOnly, get_user_school_id
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.db.models import Count, Sum, Q, IntegerField, F, Case, When
from django.db.models.functions import Coalesce
from .models import School, Advertisement, BanbeisInfo
from .serializers import SchoolSerializer, AdvertisementSerializer, BanbeisInfoSerializer
from academics.models import ClassRoom, StudentProfile, Subject
from users.models import Profile
from attendance.models import AttendanceRecord
from fees.models import Payment, StudentFeeAssignment
from datetime import datetime, timedelta
from rest_framework.views import APIView
import math

class BanbeisDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, school_id):
        try:
            info, created = BanbeisInfo.objects.get_or_create(school_id=school_id)
            student_stats = StudentProfile.objects.filter(school_id=school_id).aggregate(
                total=Count('id'),
                male=Count('id', filter=Q(gender='male')),
                female=Count('id', filter=Q(gender='female'))
            )
            teacher_stats = Profile.objects.filter(school_id=school_id, role__in=['teacher', 'admin']).aggregate(
                total=Count('id'),
                male=Count('id', filter=Q(gender='male')),
                female=Count('id', filter=Q(gender='female'))
            )
            class_data = StudentProfile.objects.filter(school_id=school_id).values('classroom__name').annotate(
                total=Count('id'), boys=Count('id', filter=Q(gender='male')), girls=Count('id', filter=Q(gender='female'))
            ).order_by('classroom__name')
            ser = BanbeisInfoSerializer(info)
            data = ser.data
            data['auto_stats'] = {'students': student_stats, 'teachers': teacher_stats, 'class_distribution': list(class_data)}
            return Response(data)
        except Exception as e: return Response({"error": str(e)}, status=400)
        
    def put(self, request, school_id):
        try:
            info, created = BanbeisInfo.objects.get_or_create(school_id=school_id)
            ser = BanbeisInfoSerializer(info, data=request.data, partial=True)
            if ser.is_valid():
                ser.save()
                student_stats = StudentProfile.objects.filter(school_id=school_id).aggregate(
                    total=Count('id'),
                    male=Count('id', filter=Q(gender='male')),
                    female=Count('id', filter=Q(gender='female'))
                )
                teacher_stats = Profile.objects.filter(school_id=school_id, role__in=['teacher', 'admin']).aggregate(
                    total=Count('id'),
                    male=Count('id', filter=Q(gender='male')),
                    female=Count('id', filter=Q(gender='female'))
                )
                class_data = StudentProfile.objects.filter(school_id=school_id).values('classroom__name').annotate(
                    total=Count('id'), boys=Count('id', filter=Q(gender='male')), girls=Count('id', filter=Q(gender='female'))
                ).order_by('classroom__name')
                data = ser.data
                data['auto_stats'] = {'students': student_stats, 'teachers': teacher_stats, 'class_distribution': list(class_data)}
                return Response(data)
            else:
                return Response(ser.errors, status=400)
        except Exception as e: return Response({"error": str(e)}, status=400)
        
    def patch(self, request, school_id):
        return self.put(request, school_id)

class SchoolViewSet(viewsets.ModelViewSet):
    serializer_class = SchoolSerializer
    permission_classes = [AdminOrReadOnly]
    queryset = School.objects.all()

    def get_queryset(self):
        return School.objects.annotate(
            student_count_annotated=Count('students')
        ).order_by('-student_count_annotated', 'name')

class AdvertisementViewSet(viewsets.ModelViewSet):
    queryset = Advertisement.objects.all()
    serializer_class = AdvertisementSerializer
    permission_classes = [permissions.AllowAny]
    def get_queryset(self):
        sid = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        qs = Advertisement.objects.all()
        if sid:
            qs = qs.filter(school_id=sid)
        return qs.select_related('school').prefetch_related()

class AdvertisementBySchool(APIView):
    def get(self, request, school_id):
        ads = Advertisement.objects.filter(school_id=school_id).order_by('-created_at', '-id')
        return Response(AdvertisementSerializer(ads, many=True, context={'request': request}).data)

class AdvertisementBulk(APIView):
    permission_classes = [permissions.IsAdminUser]
    def put(self, request):
        return Response({'status': 'restored'})

class BulkSchoolSetup(APIView):
    permission_classes = [permissions.IsAdminUser]
    def post(self, request):
        return Response({'status': 'restored'})

@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard_stats(request):
    """Returns key stats for the school dashboard with robust error handling."""
    try:
        # 1. Determine School ID
        school_id_param = request.query_params.get('school_id') or request.query_params.get('school')
        if school_id_param and str(school_id_param).isdigit():
            school_id = int(school_id_param)
        else:
            school_id = get_user_school_id(request.user, request)

        if not school_id:
            return Response({"error": "No school specified or unauthorized"}, status=400)

        # 2. Basic Info
        try:
            school_obj = School.objects.only('id', 'name').get(id=school_id)
        except School.DoesNotExist:
            return Response({"error": "School not found"}, status=404)

        # 3. Counts (Optimized)
        students_count = StudentProfile.objects.filter(school_id=school_id).count()
        teachers_count = Profile.objects.filter(school_id=school_id, role__in=['teacher', 'admin']).count()
        parents_count = Profile.objects.filter(school_id=school_id, role='parent').count()
        classes_count = ClassRoom.objects.filter(school_id=school_id).count()
        subjects_count = Subject.objects.filter(school_id=school_id).count()

        # 4. Attendance (Last 7 Days)
        today = datetime.now().date()
        week_ago = today - timedelta(days=7)
        attendance_data = list(
            AttendanceRecord.objects.filter(school_id=school_id, date__gte=week_ago)
            .values('date')
            .annotate(
                present=Coalesce(Sum(Case(When(present=True, then=1), default=0, output_field=IntegerField())), 0),
                total=Count('id'),
            )
            .annotate(absent=F('total') - F('present'))
            .values('date', 'present', 'absent')
            .order_by('date')
        )

        # 5. Today's Absent Breakdown
        today_records = AttendanceRecord.objects.filter(school_id=school_id, date=today, present=False).values('student__classroom__name').annotate(absent=Count('id'))
        attendance_absent_by_class_today = [{'class_name': r['student__classroom__name'] or 'Unknown', 'absent': r['absent']} for r in today_records]

        # 6. Recent Fees (Last 30 Days)
        month_ago = today - timedelta(days=30)
        fee_data_qs = Payment.objects.filter(student__school_id=school_id, payment_date__gte=month_ago, payment_status='completed').values('payment_date').annotate(total_amount=Sum('amount')).order_by('payment_date')
        fee_collection = [{'date': x['payment_date'], 'amount': float(x['total_amount'] or 0.0)} for x in fee_data_qs]

        # 7. Dues Calculation (Optimized - Avoid Python Loop for objects)
        tuition_due_total = 0.0
        exam_due_total = 0.0
        class_dues_map = {}

        try:
            payments = Payment.objects.filter(
                student__school_id=school_id,
                fee_assignment__isnull=False,
                payment_status='completed'
            ).values('fee_assignment_id').annotate(paid=Sum('amount'))

            paid_map = {p['fee_assignment_id']: float(p['paid'] or 0.0) for p in payments}

            assignments = StudentFeeAssignment.objects.filter(
                student__school_id=school_id,
                is_waived=False
            ).values(
                'id', 'custom_amount', 'discount_percentage',
                'student__classroom__name', 'fee_structure__amount', 'fee_structure__frequency'
            )

            for a in assignments:
                base = float(a['custom_amount'] if a['custom_amount'] is not None else a['fee_structure__amount'])
                disc = float(a['discount_percentage'])
                net = base * (1 - disc/100.0)
                paid = paid_map.get(a['id'], 0.0)
                due = net - paid

                if due <= 0.1: continue

                cname = a['student__classroom__name'] or "Unknown"
                class_dues_map.setdefault(cname, {'tuition_due': 0.0, 'exam_due': 0.0, 'total_due': 0.0})

                if a['fee_structure__frequency'] == 'one_time':
                    exam_due_total += due
                    class_dues_map[cname]['exam_due'] += due
                else:
                    tuition_due_total += due
                    class_dues_map[cname]['tuition_due'] += due
                class_dues_map[cname]['total_due'] += due

        except Exception as fee_err:
            print(f"Fee Calculation Error: {fee_err}")

        return Response({
            'school_name': school_obj.name,
            'students_count': students_count,
            'teachers_count': teachers_count,
            'parents_count': parents_count,
            'classes_count': classes_count,
            'subjects_count': subjects_count,
            'attendance_data': attendance_data,
            'attendance_absent_by_class_today': attendance_absent_by_class_today,
            'fee_collection': fee_collection,
            'fee_dues_summary': {
                'tuition_due_total': round(tuition_due_total, 2),
                'exam_due_total': round(exam_due_total, 2),
                'total_due': round(tuition_due_total + exam_due_total, 2)
            },
            'fee_dues_by_class': sorted([{'class_name': k, **v} for k, v in class_dues_map.items()], key=lambda x: x['class_name'])
        })
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return Response({"error": "Internal Server Error", "details": str(e)}, status=500)
