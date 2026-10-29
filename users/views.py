from rest_framework import generics, permissions, status, viewsets, serializers
from rest_framework_simplejwt.views import TokenObtainPairView
from users.permissions import (
    AdminOrReadOnly, RolePermission, TeacherSelfOrAdminChange,
    IsSchoolMember, is_global_admin, get_user_school_id
)
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Sum, F, Count, Q
from django.db.models.functions import TruncDate
from .models import Profile, AdminProfile, ParentProfile, CommitteeProfile, Task, AssistantLog, AssistantMemory, SupportCall, ActivityLog, SalaryStructure, PayrollRecord
from .serializers import (
    UserSerializer,
    ProfileSerializer,
    UserRegistrationSerializer,
    AdminProfileSerializer,
    ParentProfileSerializer,
    CommitteeProfileSerializer,
    TeacherProfileSerializer,
    TaskSerializer,
    ActivityLogSerializer,
    SalaryStructureSerializer,
    PayrollRecordSerializer,
)
from .sms_service import send_sms, send_bulk_sms, send_bulk_sms_async, SMSTemplates
from django.core.files.storage import default_storage
from django.conf import settings
import os
import time
import requests
import re
import unicodedata
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .assistant_logic import AssistantLogic

User = get_user_model()

class ThrottledTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        if username:
            username = unicodedata.normalize('NFKC', username).strip()

            # 1. Handle Roll Number Resolution if school_id is provided
            # The frontend can send school_id in the request body
            school_id = self.context['request'].data.get('school_id')
            if username.isdigit() and school_id:
                from academics.models import StudentProfile
                try:
                    # Try finding by roll number in the given school
                    student = StudentProfile.objects.filter(
                        school_id=school_id,
                        roll_number=username
                    ).select_related('user').first()

                    if student and student.user:
                        username = student.user.username
                except Exception:
                    pass

            from django.contrib.auth import authenticate
            user = authenticate(username=username, password=password)

            # Special handling for usernames with ZWJ (Zero Width Joiner) prefix
            # as seen in some parts of the system
            if not user and not username.startswith('\u200d'):
                zwj_username = f'\u200d{username}'
                user = authenticate(username=zwj_username, password=password)
                if user:
                    username = zwj_username

            if not user:
                raise serializers.ValidationError({'detail': 'সঠিক ইউজারনেম বা পাসওয়ার্ড দিন। অথবা আপনার শিক্ষা প্রতিষ্ঠানের এডমিনের সাথে যোগাযোগ করুন।'})

            attrs['username'] = username

        return super().validate(attrs)

class ThrottledTokenObtainPairView(TokenObtainPairView):
    serializer_class = ThrottledTokenObtainPairSerializer

class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        try:
            user = request.user
            profile, _ = Profile.objects.get_or_create(user=user)
            data = {
                "user": UserSerializer(user, context={'request': request}).data,
                "profile": ProfileSerializer(profile, context={'request': request}).data
            }
            # Include student profile data if available
            if profile.role == 'student':
                from academics.models import StudentProfile
                from academics.serializers import StudentProfileSerializer
                sp = StudentProfile.objects.filter(user=user).first()
                if sp:
                    data["student_profile"] = StudentProfileSerializer(sp, context={'request': request}).data

            return Response(data)
        except Exception as e:
            import traceback
            print(f"CurrentUserView ERROR: {type(e).__name__}: {e}")
            traceback.print_exc()
            return Response({
                "error": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request):
        user = request.user
        data = request.data
        for field in ['first_name', 'last_name', 'email', 'phone_number']:
            if field in data: setattr(user, field, data[field])
        if 'photo' in request.FILES: user.photo = request.FILES['photo']
        user.save()
        if 'gender' in data:
            try:
                profile = Profile.objects.get(user=user)
                profile.gender = data['gender']
                profile.save()
            except Exception: pass
        return Response({"message": "Updated", "user": UserSerializer(user, context={'request': request}).data})

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_object(self): return Profile.objects.get_user_or_create(self.request.user)
    def patch(self, request, *args, **kwargs):
        try:
            profile = Profile.objects.get(user=request.user)
            serializer = self.get_serializer(profile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()

            # Handle StudentProfile specific fields
            if profile.role == 'student':
                from academics.models import StudentProfile
                sp = StudentProfile.objects.filter(user=request.user).first()
                if sp:
                    updated = False
                    for f in ['ssc_board', 'ssc_roll', 'ssc_registration', 'ssc_session', 'ssc_gpa']:
                        if f in request.data:
                            setattr(sp, f, request.data[f])
                            updated = True
                    if updated:
                        sp.save()

            return Response(serializer.data)
        except Exception as e:
            return Response({"error": str(e)}, status=400)

class AdminProfileViewSet(viewsets.ModelViewSet):
    queryset = AdminProfile.objects.all()
    serializer_class = AdminProfileSerializer
    permission_classes = [AdminOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    def get_queryset(self):
        sid = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        if sid and str(sid).isdigit():
            return AdminProfile.objects.filter(school_id=sid)

        sid = get_user_school_id(self.request.user, self.request)
        if not sid:
            if is_global_admin(self.request.user):
                return AdminProfile.objects.all()
            return AdminProfile.objects.none()
        return AdminProfile.objects.filter(school_id=sid)

class ParentProfileViewSet(viewsets.ModelViewSet):
    queryset = ParentProfile.objects.all()
    serializer_class = ParentProfileSerializer
    permission_classes = [AdminOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    def get_queryset(self):
        sid = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        if sid and str(sid).isdigit():
            return ParentProfile.objects.filter(school_id=sid)

        sid = get_user_school_id(self.request.user, self.request)
        if not sid:
            if is_global_admin(self.request.user):
                return ParentProfile.objects.all()
            return ParentProfile.objects.none()
        return ParentProfile.objects.filter(school_id=sid)

class CommitteeProfileViewSet(viewsets.ModelViewSet):
    queryset = CommitteeProfile.objects.all()
    serializer_class = CommitteeProfileSerializer
    permission_classes = [AdminOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    def get_queryset(self):
        sid = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        if sid and str(sid).isdigit():
            return CommitteeProfile.objects.filter(school_id=sid)

        sid = get_user_school_id(self.request.user, self.request)
        if not sid:
            if is_global_admin(self.request.user):
                return CommitteeProfile.objects.all()
            return CommitteeProfile.objects.none()
        return CommitteeProfile.objects.filter(school_id=sid)

class TeacherProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.filter(Q(role='teacher') | Q(role='admin'))
    serializer_class = TeacherProfileSerializer
    permission_classes = [AdminOrReadOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    def get_queryset(self):
        sid = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        if sid and str(sid).isdigit():
            return Profile.objects.filter(school_id=sid).filter(Q(role='teacher') | Q(role='admin'))

        sid = get_user_school_id(self.request.user, self.request)
        if not sid:
            if is_global_admin(self.request.user):
                return Profile.objects.filter(Q(role='teacher') | Q(role='admin'))
            return Profile.objects.none()
        return Profile.objects.filter(school_id=sid).filter(Q(role='teacher') | Q(role='admin'))

class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        return self.queryset.filter(school=self.request.user.profile.school)

class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer
    permission_classes = [permissions.IsAdminUser]

class AIChatView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        from .ai_engine import SoftwareAI
        school_id = request.data.get('school') or getattr(request.user.profile, 'school_id', None)
        query = request.data.get('q')
        session_id = request.data.get('session_id')

        if not query:
            return Response({"error": "Query required"}, status=400)

        if not school_id:
            return Response({"error": "School ID required for context"}, status=400)

        ai = SoftwareAI(school_id=school_id, user=request.user)
        try:
            response = ai.ask(query, session_id=session_id, request=request)
            return Response(response)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class UsernameAvailabilityView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        if not q: return Response({"available": False}, status=400)
        exists = User.objects.filter(username=q).exists()
        return Response({"available": not exists})

class UserRegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_sms_view(request):
    data = request.data
    phone = data.get('to') or data.get('phone_number')
    message = data.get('message')
    sender = data.get('sender_mobile')
    success, msg = send_sms(phone, message, sender_mobile=sender)
    return Response({"success": success, "message": msg})

@api_view(['POST'])
def send_bulk_sms_view(request):
    data = request.data
    phones = data.get('phone_numbers') or data.get('recipients')
    message = data.get('message')
    sender = data.get('sender_mobile')

    if not phones or not isinstance(phones, list):
        return Response({"error": "phone_numbers list is required"}, status=400)

    is_async = data.get('async', False) or len(phones) > 20
    if is_async:
        success, msg = send_bulk_sms_async(phones, message, sender_mobile=sender)
        return Response({
            "success": success,
            "message": msg,
            "queued": len(phones)
        })
    else:
        results = send_bulk_sms(phones, message, sender_mobile=sender)
        sent_count = sum(1 for r in results if r['success'])
        failed_count = len(results) - sent_count

        return Response({
            "sent": sent_count,
            "failed": failed_count,
            "results": results
        })

@api_view(['POST'])
def send_template_sms_view(request):
    return Response({"status": "Feature coming soon"})

class CreateProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        profile, created = Profile.objects.get_or_create(user=request.user, defaults={'role': request.data.get('role', 'student')})
        return Response(ProfileSerializer(profile).data)

class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request): return Response({"message": "Password reset email sent"})

class ResetPasswordConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request): return Response({"message": "Password reset successful"})

class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        user = request.user
        if user.check_password(request.data.get('old_password')):
            user.set_password(request.data.get('new_password'))
            user.save()
            return Response({"success": True})
        return Response({"error": "Incorrect old password"}, status=400)

class VerifyPasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        if request.user.check_password(request.data.get('password')): return Response({"valid": True})
        return Response({"valid": False}, status=400)

class SoftwareAssistantView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request): return Response({"status": "ready"})

class VoiceUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request): return Response({"status": "ok"})

class WhatsAppSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request): return Response({"status": "ok"})

class TelegramSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request): return Response({"status": "ok"})

class AutoRuleSuggestionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request): return Response([])

class ExportSchoolCredentialsView(APIView):
    permission_classes = [IsSchoolMember]
    def get(self, request): return Response({"message": "Export started"})

class SupportCallCreateView(generics.CreateAPIView): pass
class SupportCallMyActiveView(generics.ListAPIView): pass
class SupportCallQueueView(generics.ListAPIView): pass
class SupportCallAcceptView(APIView): pass
class SupportCallRejectView(APIView): pass
class SupportCallCancelView(APIView): pass
class SupportCallEndView(APIView): pass
class SupportCallPingView(APIView): pass


class SalaryStructureViewSet(viewsets.ModelViewSet):
    queryset = SalaryStructure.objects.all()
    serializer_class = SalaryStructureSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        sid = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        if sid and str(sid).isdigit():
            return SalaryStructure.objects.filter(school_id=sid)
        user_school_id = get_user_school_id(self.request.user, self.request)
        if user_school_id:
            return SalaryStructure.objects.filter(school_id=user_school_id)
        return SalaryStructure.objects.none()


class PayrollRecordViewSet(viewsets.ModelViewSet):
    queryset = PayrollRecord.objects.all()
    serializer_class = PayrollRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = PayrollRecord.objects.all()
        sid = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        if sid and str(sid).isdigit():
            qs = qs.filter(school_id=sid)
        else:
            user_school_id = get_user_school_id(self.request.user, self.request)
            if user_school_id:
                qs = qs.filter(school_id=user_school_id)
            else:
                return PayrollRecord.objects.none()

        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        status_filter = self.request.query_params.get('status')

        if month: qs = qs.filter(month=month)
        if year: qs = qs.filter(year=year)
        if status_filter: qs = qs.filter(status=status_filter)

        return qs.order_by('-year', '-month', 'teacher__first_name')

    @action(detail=False, methods=['post'])
    def generate_monthly(self, request):
        from decimal import Decimal
        school_id = request.data.get('school') or request.data.get('school_id')
        month = request.data.get('month')
        year = request.data.get('year')

        if not school_id or not month or not year:
            return Response({"error": "school, month, and year are required"}, status=400)

        teacher_profiles = Profile.objects.filter(school_id=school_id, role__in=['teacher', 'admin']).select_related('user')

        created_count = 0
        updated_count = 0

        for prof in teacher_profiles:
            teacher_user = prof.user
            struct = SalaryStructure.objects.filter(school_id=school_id, teacher=teacher_user).first()

            basic = struct.basic_salary if struct else Decimal('0.00')
            allowances = struct.get_gross_salary() - basic if struct else Decimal('0.00')
            deductions = struct.get_total_deductions() if struct else Decimal('0.00')
            gross = struct.get_gross_salary() if struct else Decimal('0.00')
            net = struct.get_net_salary() if struct else Decimal('0.00')

            record, created = PayrollRecord.objects.update_or_create(
                school_id=school_id,
                teacher=teacher_user,
                month=month,
                year=year,
                defaults={
                    'basic_salary': basic,
                    'allowances': allowances,
                    'deductions': deductions,
                    'gross_salary': gross,
                    'net_salary': net,
                    'status': 'pending'
                }
            )
            if created: created_count += 1
            else: updated_count += 1

        return Response({
            "message": f"Generated payroll for {month}/{year}",
            "created": created_count,
            "updated": updated_count
        })

    @action(detail=True, methods=['post'])
    def pay_salary(self, request, pk=None):
        from django.utils import timezone
        record = self.get_object()
        if record.status == 'paid':
            return Response({"error": "This salary is already paid"}, status=400)

        payment_method = request.data.get('payment_method', 'cash')
        payment_reference = request.data.get('payment_reference', '')
        note = request.data.get('note', '')
        payment_date = request.data.get('payment_date') or timezone.now().date()

        record.status = 'paid'
        record.payment_method = payment_method
        record.payment_reference = payment_reference
        record.note = note
        record.payment_date = payment_date
        record.save()

        return Response({
            "message": "Salary marked as paid",
            "record": PayrollRecordSerializer(record).data
        })

