from rest_framework import generics, permissions, status, viewsets, serializers
from rest_framework_simplejwt.views import TokenObtainPairView
from users.permissions import AdminOrReadOnly, RolePermission, TeacherSelfOrAdminChange, IsSchoolMember
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import get_user_model
from django.db.models import Sum, F, Count
from django.db.models.functions import TruncDate
from .models import Profile, AdminProfile, ParentProfile, CommitteeProfile, Task, AssistantLog, AssistantMemory, SupportCall, ActivityLog
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
)
from .sms_service import send_sms, send_bulk_sms, SMSTemplates
from django.core.files.storage import default_storage
from django.conf import settings
import os
import time
import requests
import re
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.contrib.auth.tokens import PasswordResetTokenGenerator
import secrets, string, io, datetime, csv
import unicodedata
import uuid
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .ai_engine import SoftwareAI
from .assistant_logic import AssistantLogic

User = get_user_model()

class ThrottledTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        
        if username:
            # Normalize and strip
            username = unicodedata.normalize('NFKC', username).strip()
            
            from django.contrib.auth import get_user_model, authenticate
            User = get_user_model()
            
            # Check if user exists as-is
            user = authenticate(username=username, password=password)
            
            # If not found, try with Zero Width Joiner (\u200d) prefix
            if not user and not username.startswith('\u200d'):
                zwj_username = f'\u200d{username}'
                user = authenticate(username=zwj_username, password=password)
                if user:
                    attrs['username'] = zwj_username
            elif user:
                attrs['username'] = username

            if not user:
                raise serializers.ValidationError({'detail': 'No active account found with the given credentials'})
        
        return super().validate(attrs)

class ThrottledTokenObtainPairView(TokenObtainPairView):
    serializer_class = ThrottledTokenObtainPairSerializer

class UsernameAvailabilityView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        if not q:
            return Response({"available": False, "error": "No username provided"}, status=status.HTTP_400_BAD_REQUEST)
        exists = User.objects.filter(username=q).exists()
        suggestions = []
        base = q.lower().replace(' ', '')
        i = 1
        while len(suggestions) < 5 and i <= 50:
            candidate = f"{base}{i}"
            if not User.objects.filter(username=candidate).exists():
                suggestions.append(candidate)
            i += 1
        return Response({"available": not exists, "suggestions": suggestions})

class UserRegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [AdminOrReadOnly]
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        school_id = request.data.get('school')
        role = request.data.get('role', 'student')
        Profile.objects.update_or_create(user=user, defaults={'school_id': school_id, 'role': role})
        return Response({"user": UserSerializer(user).data, "message": "User registered successfully"}, status=status.HTTP_201_CREATED)

class VoiceUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('voice') or request.FILES.get('audio')
        if not file_obj:
            return Response({"success": False, "error": "No voice file provided"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ts = int(time.time())
            name = os.path.basename(getattr(file_obj, 'name', f'voice_message_{ts}.webm'))
            path = f"voice_messages/{ts}_{name}"
            saved_path = default_storage.save(path, file_obj)
            base_url = getattr(settings, 'MEDIA_URL', '/media/')
            rel_url = f"{base_url}{saved_path}"
            site_base = (getattr(settings, 'SITE_BASE_URL', '') or '').rstrip('/')
            absolute_url = rel_url
            return Response({"success": True, "url": absolute_url, "filename": name}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class WhatsAppSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    def post(self, request, *args, **kwargs):
        token = getattr(settings, 'WHATSAPP_TOKEN', '')
        phone_id = getattr(settings, 'WHATSAPP_PHONE_ID', '')
        base = getattr(settings, 'WHATSAPP_BASE_URL', 'https://graph.facebook.com/v20.0')
        message = (request.data.get('message') or '').strip()
        phones = request.data.get('phone_numbers') or []
        audio_url = request.data.get('audio_url')
        audio_file = request.FILES.get('audio')
        if isinstance(phones, str):
            try: phones = json.loads(phones)
            except: phones = [p.strip() for p in phones.split(',') if p.strip()]
        def _normalize_phone(p):
            d = re.sub(r'\D', '', str(p or ''))
            if not d: return None
            if d.startswith('01') and len(d) == 11: return f"880{d[1:]}"
            if d.startswith('0'): return f"880{d.lstrip('0')}"
            return d
        phones = [x for x in map(_normalize_phone, phones) if x]
        if not token or not phone_id:
            results = [{"to": p, "success": False, "message": "dry_run"} for p in phones]
            return Response({"success": True, "sent": 0, "failed": len(phones), "message": "dry_run", "results": results})
        url = f"{base}/{phone_id}/messages"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        results = []
        for p in phones:
            payload = {"messaging_product": "whatsapp", "to": p, "type": "text", "text": {"body": message}}
            try:
                r = requests.post(url, json=payload, headers=headers, timeout=15)
                results.append({"to": p, "success": r.status_code in (200, 201), "status_code": r.status_code, "response_text": r.text})
            except Exception as e:
                results.append({"to": p, "success": False, "error": str(e)})
        sent_count = sum(1 for item in results if item.get('success'))
        failed_count = len(results) - sent_count
        return Response({"success": True, "sent": sent_count, "failed": failed_count, "results": results})

class TelegramSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
        message = request.data.get('message')
        chat_ids = request.data.get('chat_ids', [])
        if not token: return Response({"success": True, "message": "dry_run"})
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        results = []
        for cid in chat_ids:
            try:
                r = requests.post(url, json={"chat_id": cid, "text": message}, timeout=15)
                results.append({"chat_id": cid, "success": r.status_code == 200})
            except: results.append({"chat_id": cid, "success": False})
        return Response({"success": True, "results": results})

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_object(self): return Profile.objects.get(user=self.request.user)

class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        user = request.user
        profile = Profile.objects.get(user=user)
        return Response({"user": UserSerializer(user, context={'request': request}).data, "profile": ProfileSerializer(profile).data})
    def patch(self, request):
        user = request.user
        for field in ['first_name', 'last_name', 'email']:
            if field in request.data: setattr(user, field, request.data[field])
        if 'photo' in request.FILES: user.photo = request.FILES['photo']
        user.save()
        return Response({"message": "Updated", "user": UserSerializer(user, context={'request': request}).data})

class AIChatView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        school_id = request.data.get('school') or getattr(request.user.profile, 'school_id', None)
        query = request.data.get('q')
        session_id = request.data.get('session_id')
        if not query: return Response({"error": "Query required"}, status=400)
        logic = AssistantLogic(request, school_id=school_id)
        try:
            local_resp = logic.get_response(query, extra_params=request.data)
        except Exception as e:
            AssistantLog.objects.create(
                user=request.user,
                school_id=school_id,
                query_text=query,
                intent='',
                params=request.data,
                result_summary=str(e)[:200]
            )
            return Response({"text": "দুঃখিত, আমি আপনার প্রশ্নটি এখন প্রক্রিয়াকরণ করতে পারছি না। দয়া করে আবার চেষ্টা করুন।"})

        if local_resp:
            ai = SoftwareAI(school_id, user=request.user)
            session = ai.get_or_create_session(session_id)
            from .models import AIChatMessage
            AIChatMessage.objects.create(session=session, role='user', content=query)
            AIChatMessage.objects.create(session=session, role='assistant', content=local_resp.get('text', ''))
            local_resp.update({'session_id': session.id, 'role': 'assistant'})
            return Response(local_resp)
        ai = SoftwareAI(school_id, user=request.user)
        try:
            return Response(ai.ask(query, session_id=session_id))
        except Exception:
            return Response({"text": "দুঃখিত, আমার AI মডিউলে কিছু সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।"})
    def get(self, request):
        school_id = request.query_params.get('school') or getattr(request.user.profile, 'school_id', None)
        session_id = request.query_params.get('session_id')
        if not session_id: return Response({"error": "Session ID required"}, status=400)
        ai = SoftwareAI(school_id, user=request.user)
        return Response({"history": ai.get_history(session_id)})

class SoftwareAssistantView(APIView):
    permission_classes = [IsSchoolMember, RolePermission]
    def get(self, request):
        q = (request.query_params.get('q') or request.query_params.get('query') or '').strip()
        school_id = request.query_params.get('school')
        logic = AssistantLogic(request, school_id=school_id)
        try:
            resp = logic.get_response(q, extra_params=request.query_params)
        except Exception as e:
            AssistantLog.objects.create(
                user=request.user,
                school_id=school_id,
                query_text=q,
                intent='',
                params=request.query_params.dict(),
                result_summary=str(e)[:200]
            )
            return Response({"text": "দুঃখিত, আমি আপনার প্রশ্নটি এখন প্রক্রিয়াকরণ করতে পারছি না। দয়া করে আবার চেষ্টা করুন।"})
        if resp: return Response(resp)
        ai = SoftwareAI(school_id, user=request.user)
        try:
            return Response(ai.ask(q, session_id=request.query_params.get('session_id'), request=request))
        except Exception:
            return Response({"text": "দুঃখিত, আমার AI মডিউলে কিছু সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।"})

class CreateProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        user = request.user
        if hasattr(user, 'profile'):
            return Response({
                "message": "Profile already exists",
                "user": UserSerializer(user, context={'request': request}).data,
                "profile": ProfileSerializer(user.profile).data
            })
        profile = Profile.objects.create(
            user=user,
            role=request.data.get('role', 'student')
        )
        if 'first_name' in request.data: user.first_name = request.data['first_name']
        if 'last_name' in request.data: user.last_name = request.data['last_name']
        if 'email' in request.data: user.email = request.data['email']
        user.save()
        return Response({
            "message": "Profile created successfully",
            "user": UserSerializer(user, context={'request': request}).data,
            "profile": ProfileSerializer(profile).data
        }, status=status.HTTP_201_CREATED)

class VerifyPasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        pwd = (request.data.get('password') or '').strip()
        if not pwd: return Response({"valid": False, "error": "Password required"}, status=400)
        if request.user.check_password(pwd): return Response({"valid": True})
        return Response({"valid": False, "error": "Invalid password"}, status=401)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_sms_view(request):
    phone_number = request.data.get('phone_number')
    message = request.data.get('message')
    if not phone_number or not message:
        return Response({"error": "phone_number and message are required"}, status=400)
    success, result_message = send_sms(phone_number, message)
    return Response({"success": success, "message": result_message} if success else {"success": False, "error": result_message}, status=200 if success else 400)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_bulk_sms_view(request):
    phone_numbers = request.data.get('phone_numbers', [])
    message = request.data.get('message')
    if not phone_numbers or not message:
        return Response({"error": "phone_numbers (array) and message are required"}, status=400)
    results = send_bulk_sms(phone_numbers, message)
    success_count = sum(1 for r in results if r['success'])
    return Response({"success": True, "total": len(results), "sent": success_count, "failed": len(results)-success_count, "results": results})

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_template_sms_view(request):
    template_name = request.data.get('template')
    template_data = request.data.get('data', {})
    phone_number = request.data.get('phone_number')
    if not template_name or not phone_number:
        return Response({"error": "template and phone_number are required"}, status=400)
    templates = {
        'admission': SMSTemplates.admission_confirmation,
        'result': SMSTemplates.result_published,
        'fee_reminder': SMSTemplates.fee_reminder,
        'attendance': SMSTemplates.attendance_alert,
        'exam_schedule': SMSTemplates.exam_schedule,
        'meeting': SMSTemplates.meeting_invitation,
    }
    template_func = templates.get(template_name)
    if not template_func: return Response({"error": f"Template '{template_name}' not found"}, status=400)
    try:
        message = template_func(**template_data)
        success, result_message = send_sms(phone_number, message)
        return Response({"success": success, "message": result_message, "sms_content": message} if success else {"success": False, "error": result_message}, status=200 if success else 400)
    except TypeError as e: return Response({"error": f"Invalid template data: {str(e)}"}, status=400)

class AdminProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.select_related('user', 'school').filter(role='admin')
    serializer_class = AdminProfileSerializer
    permission_classes = [AdminOrReadOnly]
    filterset_fields = ['school']
    parser_classes = [MultiPartParser, FormParser]
    def get_queryset(self):
        qs = super().get_queryset()
        sid = self.request.query_params.get('school')
        if sid: qs = qs.filter(school_id=sid)
        return qs

class ParentProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.select_related('user', 'school').filter(role='parent')
    serializer_class = ParentProfileSerializer
    permission_classes = [IsSchoolMember, RolePermission]
    filterset_fields = ['school']
    parser_classes = [MultiPartParser, FormParser]
    def get_queryset(self):
        qs = super().get_queryset()
        sid = self.request.query_params.get('school')
        if sid: qs = qs.filter(school_id=sid)
        return qs

class CommitteeProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.select_related('user', 'school').filter(role='committee')
    serializer_class = CommitteeProfileSerializer
    permission_classes = [IsSchoolMember, RolePermission]
    filterset_fields = ['school']
    parser_classes = [MultiPartParser, FormParser]
    def get_queryset(self):
        qs = super().get_queryset()
        sid = self.request.query_params.get('school')
        if sid: qs = qs.filter(school_id=sid)
        return qs

class TeacherProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.select_related('user', 'school', 'class_teacher_classroom', 'class_teacher_section').prefetch_related('user__assignments', 'user__assignments__subject', 'user__assignments__classroom', 'user__assignments__section').filter(role='teacher')
    serializer_class = TeacherProfileSerializer
    permission_classes = [IsSchoolMember, TeacherSelfOrAdminChange]
    filterset_fields = ['school', 'user']
    parser_classes = [MultiPartParser, FormParser]
    def get_queryset(self):
        qs = super().get_queryset()
        sid = self.request.query_params.get('school')
        if sid: qs = qs.filter(school_id=sid)
        return qs

class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.select_related('assigned_to', 'school', 'created_by').all()
    serializer_class = TaskSerializer
    permission_classes = [IsSchoolMember, AdminOrReadOnly]
    filterset_fields = ['school', 'assigned_to', 'status', 'priority']
    def get_queryset(self):
        qs = super().get_queryset()
        sid = self.request.query_params.get('school')
        if sid: qs = qs.filter(school_id=sid)
        uid = self.request.query_params.get('assigned_to')
        if uid: qs = qs.filter(assigned_to_id=uid)
        return qs

class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        email = request.data.get('email')
        if not email: return Response({"error": "Email required"}, status=400)
        try:
            user = User.objects.get(email=email)
            token = PasswordResetTokenGenerator().make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            site_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
            reset_url = f"{site_url}/reset-password/{uid}/{token}"
            send_mail('Password Reset Request', f'Click here: {reset_url}', settings.DEFAULT_FROM_EMAIL, [email])
            return Response({"message": "Password reset email sent."})
        except User.DoesNotExist: return Response({"message": "If account exists, email sent."})

class ResetPasswordConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')
        if not all([uidb64, token, new_password]): return Response({"error": "Missing data"}, status=400)
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
            if PasswordResetTokenGenerator().check_token(user, token):
                user.set_password(new_password)
                user.save()
                return Response({"success": True, "message": "Password reset successful."})
            return Response({"error": "Invalid token"}, status=400)
        except: return Response({"error": "Invalid link"}, status=400)

class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        old_pwd = request.data.get('old_password')
        new_pwd = request.data.get('new_password')
        if not old_pwd or not new_pwd: return Response({"error": "Missing password"}, status=400)
        if not request.user.check_password(old_pwd): return Response({"error": "Wrong old password"}, status=400)
        request.user.set_password(new_pwd)
        request.user.save()
        return Response({"success": True, "message": "Password changed."})

class ExportSchoolCredentialsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        sid = request.data.get('school_id')
        if not sid: return Response({"error": "School ID required"}, status=400)
        users = User.objects.filter(profile__school_id=sid).select_related('profile')
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Username', 'Full Name', 'Role', 'Phone'])
        for u in users:
            writer.writerow([u.username, u.get_full_name(), getattr(u.profile, 'role', ''), u.phone_number])
        response = Response(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="school_{sid}_credentials.csv"'
        return response

class AutoRuleSuggestionView(APIView):
    permission_classes = [IsSchoolMember]
    def get(self, request):
        sid = request.query_params.get('school') or getattr(request.user.profile, 'school_id', None)
        mem, _ = AssistantMemory.objects.get_or_create(school_id=sid or 0, key='auto_rules')
        return Response({"school": sid, "rules": mem.data or {}})
    def post(self, request):
        sid = request.data.get('school') or getattr(request.user.profile, 'school_id', None)
        mem, _ = AssistantMemory.objects.get_or_create(school_id=sid or 0, key='auto_rules')
        mem.data = request.data.get('rules', {})
        mem.save()
        return Response({"success": True})

def _is_support_agent(user):
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    try:
        if getattr(user, 'is_superuser', False):
            return True
        # Strip all non-printable/invisible characters like ZWJ (\u200d)
        uname = (getattr(user, 'username', '') or '').strip()
        uname = re.sub(r'[^\x20-\x7E]', '', uname).lower()
        email = (getattr(user, 'email', '') or '').strip().lower()
        if uname == 'bdadmin':
            return True
        if email == 'hasinurrahmanakram@gmail.com':
            return True
    except Exception:
        return False
    return False

def _support_call_to_dict(call):
    if not call:
        return None
    requester = getattr(call, 'requester', None)
    accepted_by = getattr(call, 'accepted_by', None)
    return {
        "id": call.id,
        "school_id": getattr(call, 'school_id', None),
        "status": call.status,
        "room_name": call.room_name,
        "requester_label": call.requester_label,
        "created_at": call.created_at.isoformat() if call.created_at else None,
        "accepted_at": call.accepted_at.isoformat() if call.accepted_at else None,
        "ended_at": call.ended_at.isoformat() if call.ended_at else None,
        "requester": {
            "id": requester.id if requester else None,
            "username": getattr(requester, 'username', None),
            "name": (requester.get_full_name() if requester else '') or getattr(requester, 'username', ''),
            "email": getattr(requester, 'email', None),
        },
        "accepted_by": {
            "id": accepted_by.id if accepted_by else None,
            "username": getattr(accepted_by, 'username', None),
            "name": (accepted_by.get_full_name() if accepted_by else '') or getattr(accepted_by, 'username', ''),
            "email": getattr(accepted_by, 'email', None),
        } if accepted_by else None,
    }

class SupportCallCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            school_id = request.data.get('school') or request.data.get('school_id') or getattr(getattr(request.user, 'profile', None), 'school_id', None)
            if not school_id:
                return Response({"error": "school_id required"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                school_id = int(school_id)
            except Exception:
                return Response({"error": "invalid school_id"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check for existing waiting/accepted calls to avoid duplicates
            existing = (
                SupportCall.objects
                .filter(requester=request.user, school_id=school_id, status__in=['waiting', 'accepted'])
                .order_by('-created_at')
                .first()
            )
            if existing:
                return Response({"call": _support_call_to_dict(existing)}, status=status.HTTP_200_OK)

            room_name = f"bdapp_support_{school_id}_{uuid.uuid4().hex[:12]}"
            requester_label = (request.user.get_full_name() or request.user.username or '').strip()
            call = SupportCall.objects.create(
                school_id=school_id,
                requester=request.user,
                room_name=room_name,
                requester_label=requester_label,
                status='waiting'
            )
            return Response({"call": _support_call_to_dict(call)}, status=status.HTTP_201_CREATED)
        except Exception as e:
            print(f"DEBUG: SupportCallCreateView Error: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SupportCallMyActiveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            school_id = request.query_params.get('school') or request.query_params.get('school_id') or getattr(getattr(request.user, 'profile', None), 'school_id', None)
            qs = SupportCall.objects.filter(requester=request.user, status__in=['waiting', 'accepted']).order_by('-created_at')
            if school_id:
                try:
                    qs = qs.filter(school_id=int(school_id))
                except Exception:
                    pass
            call = qs.first()
            return Response({"call": _support_call_to_dict(call) if call else None})
        except Exception as e:
            print(f"DEBUG: SupportCallMyActiveView Error: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SupportCallQueueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            if not _is_support_agent(request.user):
                return Response({"error": "not allowed"}, status=status.HTTP_403_FORBIDDEN)
            
            school_id = request.query_params.get('school') or request.query_params.get('school_id')
            qs = SupportCall.objects.select_related('requester', 'accepted_by').filter(status='waiting').order_by('created_at')
            
            # If school_id is 'all', show everything. Otherwise, if school_id is provided, filter by it.
            if school_id and school_id != 'all':
                try:
                    qs = qs.filter(school_id=int(school_id))
                except Exception:
                    pass
            
            items = [_support_call_to_dict(c) for c in qs[:50]]
            return Response({"calls": items})
        except Exception as e:
            print(f"DEBUG: SupportCallQueueView Error: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SupportCallAcceptView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, call_id):
        try:
            if not _is_support_agent(request.user):
                return Response({"error": "not allowed"}, status=status.HTTP_403_FORBIDDEN)
            try:
                cid = int(call_id)
            except Exception:
                return Response({"error": "invalid_call_id"}, status=status.HTTP_400_BAD_REQUEST)
            with transaction.atomic():
                # Fix: remove select_related from select_for_update to avoid PostgreSQL "outer join" error
                call = SupportCall.objects.select_for_update().filter(id=cid).first()
                if not call:
                    return Response({"error": "not found"}, status=status.HTTP_404_NOT_FOUND)
                if call.status != 'waiting':
                    return Response({"error": "call not waiting", "call": _support_call_to_dict(call)}, status=status.HTTP_409_CONFLICT)
                call.status = 'accepted'
                call.accepted_by = request.user
                call.accepted_at = timezone.now()
                call.save(update_fields=['status', 'accepted_by', 'accepted_at'])
                
                # Auto-reject/cancel other waiting calls for this requester (optional but cleaner)
                SupportCall.objects.filter(requester=call.requester, status='waiting').exclude(id=call.id).update(status='cancelled', ended_at=timezone.now())
                
            return Response({"call": _support_call_to_dict(call)})
        except Exception as e:
            print(f"DEBUG: SupportCallAcceptView Error: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SupportCallRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, call_id):
        if not _is_support_agent(request.user):
            return Response({"error": "not allowed"}, status=status.HTTP_403_FORBIDDEN)
        try:
            cid = int(call_id)
        except Exception:
            return Response({"error": "invalid call_id"}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            # Fix: remove select_related from select_for_update to avoid PostgreSQL "outer join" error
            call = SupportCall.objects.select_for_update().filter(id=cid).first()
            if not call:
                return Response({"error": "not found"}, status=status.HTTP_404_NOT_FOUND)
            if call.status != 'waiting':
                return Response({"error": "call not waiting", "call": _support_call_to_dict(call)}, status=status.HTTP_409_CONFLICT)
            call.status = 'rejected'
            call.ended_at = timezone.now()
            call.save(update_fields=['status', 'ended_at'])
        return Response({"call": _support_call_to_dict(call)})

class SupportCallCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, call_id):
        try:
            cid = int(call_id)
        except Exception:
            return Response({"error": "invalid call_id"}, status=status.HTTP_400_BAD_REQUEST)
        call = SupportCall.objects.select_related('requester', 'accepted_by').filter(id=cid, requester=request.user).first()
        if not call:
            return Response({"error": "not found"}, status=status.HTTP_404_NOT_FOUND)
        if call.status in ('ended', 'cancelled', 'rejected'):
            return Response({"call": _support_call_to_dict(call)})
        call.status = 'cancelled'
        call.ended_at = timezone.now()
        call.save(update_fields=['status', 'ended_at'])
        return Response({"call": _support_call_to_dict(call)})

class SupportCallEndView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, call_id):
        try:
            cid = int(call_id)
        except Exception:
            return Response({"error": "invalid call_id"}, status=status.HTTP_400_BAD_REQUEST)
        call = SupportCall.objects.select_related('requester', 'accepted_by').filter(id=cid).first()
        if not call:
            return Response({"error": "not found"}, status=status.HTTP_404_NOT_FOUND)
        is_owner = call.requester_id == request.user.id
        is_agent = _is_support_agent(request.user) and (call.accepted_by_id == request.user.id or call.accepted_by_id is None)
        if not (is_owner or is_agent):
            return Response({"error": "not allowed"}, status=status.HTTP_403_FORBIDDEN)
        if call.status in ('ended', 'cancelled', 'rejected'):
            return Response({"call": _support_call_to_dict(call)})
        call.status = 'ended'
        call.ended_at = timezone.now()
        call.save(update_fields=['status', 'ended_at'])
        return Response({"call": _support_call_to_dict(call)})

class SupportCallPingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, call_id):
        try:
            cid = int(call_id)
        except Exception:
            return Response({"error": "invalid call_id"}, status=status.HTTP_400_BAD_REQUEST)
        call = SupportCall.objects.filter(id=cid, requester=request.user, status__in=['waiting', 'accepted']).first()
        if not call:
            return Response({"ok": False}, status=status.HTTP_404_NOT_FOUND)
        call.last_client_ping_at = timezone.now()
        call.save(update_fields=['last_client_ping_at'])
        return Response({"ok": True})

class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ActivityLog.objects.all().select_related('user', 'school')
    serializer_class = ActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Check if user is superuser/staff OR specific admin role
        is_master = user.is_superuser or user.is_staff
        
        if is_master:
            school_id = self.request.query_params.get('school')
            if school_id:
                qs = qs.filter(school_id=school_id)
            return qs
            
        if hasattr(user, 'profile') and user.profile.school:
            return qs.filter(school=user.profile.school)
        return qs.none()

    @action(detail=False, methods=['get'])
    def reports(self, request):
        if not (request.user.is_superuser or request.user.is_staff):
            return Response({"detail": "Not authorized"}, status=403)
            
        days = int(request.query_params.get('days', 30))
        cutoff = timezone.now() - timezone.timedelta(days=days)
        
        # Daily summary for profile creations
        daily_stats = ActivityLog.objects.filter(
            action_type='profile_create',
            timestamp__gte=cutoff
        ).annotate(date=TruncDate('timestamp')).values('date').annotate(
            count=Count('id'),
            total_cost=Sum('cost')
        ).order_by('-date')
        
        # School-wise summary
        school_stats = ActivityLog.objects.filter(
            action_type='profile_create',
            timestamp__gte=cutoff
        ).values('school__name', 'school__id').annotate(
            count=Count('id'),
            total_cost=Sum('cost')
        ).order_by('-total_cost')

        return Response({
            "daily_stats": daily_stats,
            "school_stats": school_stats,
            "total_earnings": ActivityLog.objects.filter(action_type='profile_create').aggregate(Sum('cost'))['cost__sum'] or 0
        })
