from rest_framework import permissions

def is_global_admin(user):
    """Helper to check for bdadmin or School 6 staff."""
    if not user or not user.is_authenticated:
        return False

    # Normalize username (handle zero-width characters)
    uname = str(getattr(user, 'username', '')).lower().strip()
    uname = ''.join(c for c in uname if not (0x200B <= ord(c) <= 0x200D or ord(c) == 0xFEFF))

    if uname == 'bdadmin' or getattr(user, 'is_superuser', False):
        return True

    profile = getattr(user, 'profile', None)
    if profile:
        # Special case: School 6 teachers are global admins
        user_school_id = getattr(profile, 'school_id', None) or (profile.school.id if profile.school else None)
        if str(user_school_id) == '6' and profile.role == 'teacher':
            return True

    return False

def is_effective_admin(user, request=None):
    """
    Check if user has management permissions for a school.
    """
    if not user or not user.is_authenticated:
        return False

    uname = str(getattr(user, 'username', '')).lower().strip()
    uname = ''.join(c for c in uname if not (0x200B <= ord(c) <= 0x200D or ord(c) == 0xFEFF))
    is_bdadmin = uname == 'bdadmin' or 'bdadmin' in uname

    # Target school resolution
    target_school_id = None
    if request:
        target_school_id = request.query_params.get('school') or request.query_params.get('school_id')
        if not target_school_id:
            try:
                view = getattr(request, 'parser_context', {}).get('view')
                if view and hasattr(view, 'kwargs'):
                    kwargs = view.kwargs
                    target_school_id = kwargs.get('school_id') or kwargs.get('school_pk') or kwargs.get('id')
                    if not target_school_id and view.__class__.__name__ in ('SchoolViewSet', 'SchoolDetailView'):
                        target_school_id = kwargs.get('pk')
            except Exception:
                pass

    # Strictly enforce: School 69 management is ONLY allowed for bdadmin
    if target_school_id and str(target_school_id) == '69' and not is_bdadmin:
        return False

    if is_global_admin(user):
        return True

    profile = getattr(user, 'profile', None)
    if not profile or not profile.school_id:
        return False
        
    role = getattr(profile, 'role', None)
    user_school_id = str(profile.school_id)

    # Authorized roles for school management
    if role in ('admin', 'super_admin', 'teacher'):
        # If a specific school is targetted, it MUST match the user's school
        if target_school_id and str(target_school_id) != user_school_id:
            return False

        return True

    return False

def get_user_school_id(user, request=None):
    """Robust school ID resolver."""
    if not user or not user.is_authenticated:
        return None

    sid = None
    if request:
        # Check query params first (GET/DELETE)
        sid = request.query_params.get('school') or request.query_params.get('school_id')

        # Check parser context (URL kwargs like school_id, id, etc.)
        if not sid:
            try:
                view = getattr(request, 'parser_context', {}).get('view')
                if view and hasattr(view, 'kwargs'):
                    sid = view.kwargs.get('school_id') or view.kwargs.get('school_pk') or view.kwargs.get('id')
            except Exception:
                pass

        # Check Referer header if available (e.g., /school/12/...)
        if not sid and hasattr(request, 'headers') and request.headers.get('referer'):
            try:
                referer = request.headers.get('referer', '')
                import re
                m = re.search(r'/school/(\d+)', referer)
                if m:
                    sid = m.group(1)
            except Exception:
                pass

        # Check POST/PATCH/PUT data if not found in query params
        if not sid and request.method not in permissions.SAFE_METHODS and hasattr(request, 'data') and isinstance(request.data, dict):
            sid = request.data.get('school') or request.data.get('school_id')

    if sid and str(sid).isdigit():
        return int(sid)

    # 1. Global Admin without explicit school:
    if is_global_admin(user):
        return None

    # 2. Regular User: Always restricted to their own school
    profile = getattr(user, 'profile', None)
    if profile and profile.school_id:
        return profile.school_id
    return None

class AdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return is_effective_admin(request.user, request)

class IsSchoolMember(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_effective_admin(request.user, request):
            return True

        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.school_id:
            return False

        user_school_id = str(profile.school_id)
        target_school_id = request.query_params.get('school') or request.query_params.get('school_id')
        if not target_school_id:
            try:
                view = getattr(request, 'parser_context', {}).get('view')
                if view and hasattr(view, 'kwargs'):
                    target_school_id = view.kwargs.get('school_id') or view.kwargs.get('school_pk') or view.kwargs.get('id')
            except Exception:
                pass
        if not target_school_id and request.method not in permissions.SAFE_METHODS and hasattr(request, 'data') and isinstance(request.data, dict):
            target_school_id = request.data.get('school') or request.data.get('school_id')

        if target_school_id and str(target_school_id) != user_school_id:
            return False
        return True

class RolePermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if is_effective_admin(user, request):
            return True
        profile = getattr(user, 'profile', None)
        if not profile:
            return False
        role = str(getattr(profile, 'role', '')).lower().strip()
        designation = str(getattr(profile, 'designation', '')).lower().strip()
        return role in ('teacher', 'admin', 'super_admin', 'staff', 'headmaster', 'principal') or 'teacher' in role or 'admin' in role or 'প্রধান' in designation or 'teacher' in designation or 'principal' in designation

    def has_object_permission(self, request, view, obj):
        user = request.user
        if is_effective_admin(user, request):
            return True
        if request.method in permissions.SAFE_METHODS:
            return True

        profile = getattr(user, 'profile', None)
        if not profile:
            return False

        role = str(getattr(profile, 'role', '')).lower().strip()
        is_staff_role = role in ('teacher', 'admin', 'super_admin', 'staff', 'headmaster', 'principal') or 'teacher' in role or 'admin' in role
        if is_staff_role:
            # Allow staff to modify/delete objects in their own school
            obj_school_id = getattr(obj, 'school_id', None) or (getattr(obj.school, 'id', None) if hasattr(obj, 'school') and obj.school else None)
            if obj_school_id and str(obj_school_id) == str(profile.school_id):
                return True
            return request.method != 'DELETE'

        try:
            target_user_id = getattr(obj, 'user_id', getattr(getattr(obj, 'user', None), 'id', None))
            return target_user_id == user.id
        except:
            return False

class SubjectResultWritePermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if is_effective_admin(user, request):
            return True
        try:
            from academics.models import TeacherAssignment
            incoming_subject_id = request.data.get('subject_id') or request.data.get('subject')
            if not incoming_subject_id:
                return getattr(view, 'action', None) == 'bulk_results'
            return TeacherAssignment.objects.filter(teacher=user, subject_id=incoming_subject_id).exists()
        except:
            return False

class TeacherSelfOrAdminChange(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if is_effective_admin(user, request):
            return True
        profile = getattr(user, 'profile', None)
        return profile and profile.role in ('teacher', 'admin', 'super_admin')

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if is_effective_admin(user, request):
            return True
        profile = getattr(user, 'profile', None)
        if profile and profile.role in ('teacher', 'admin', 'super_admin'):
            return True
        try:
            target_id = getattr(obj, 'user_id', getattr(obj, 'id', None))
            return target_id == user.id
        except:
            return False

class TeacherSubjectResultPermission(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if is_effective_admin(user, request):
            return True
        try:
            from academics.models import TeacherAssignment
            return TeacherAssignment.objects.filter(teacher=user, subject_id=obj.subject_id).exists()
        except:
            return False
