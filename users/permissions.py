from rest_framework import permissions

def is_effective_admin(user):
    """
    Check if a user is an effective admin.
    Effective admin means:
    - Superuser or staff
    - Profile role is 'admin' or 'super_admin'
    - Profile designation includes 'প্রধান শিক্ষক', 'Headmaster', or 'Principal'
    - Username is 'shamir', 'umor', or 'bdadmin'
    """
    if not user or not user.is_authenticated:
        return False
    
    # Check for specific usernames (Principal and Superuser)
    # Strip zero-width characters (like \u200d, \u200b, \ufeff) and whitespace
    uname = str(getattr(user, 'username', '')).lower()
    # Remove all zero-width and invisible characters
    uname = ''.join(c for c in uname if not (0x200B <= ord(c) <= 0x200D or ord(c) == 0xFEFF))
    uname = uname.strip()
    if uname in ('shamir', 'bdadmin', 'umor'):
        return True
        
    if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
        return True
        
    profile = getattr(user, 'profile', None)
    if not profile:
        return False
        
    role = getattr(profile, 'role', None)
    designation = str(getattr(profile, 'designation', None) or '').strip()
    
    is_admin_role = role in ('admin', 'super_admin')
    is_principal_designation = any(x in designation for x in ['প্রধান শিক্ষক', 'Headmaster', 'Principal', 'Head Master', 'সহকারী প্রধান শিক্ষক'])
    
    return is_admin_role or is_principal_designation

class AdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return is_effective_admin(getattr(request, 'user', None))

class IsSchoolMember(permissions.BasePermission):
    """
    Ensures that a user can only access resources belonging to their own school.
    Superusers and staff are exempt.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        # Superusers, staff and effective admins (Principal) can access any school
        if is_effective_admin(request.user):
            return True
            
        # Get the current school from the request (attached by TenantMiddleware)
        current_school = getattr(request, 'current_school', None)
        
        # If no school is identified in the request, we can't enforce this check here
        if not current_school:
            return True

        # Get the user's school from their profile
        profile = getattr(request.user, 'profile', None)
        if not profile or not profile.school:
            return False
            
        # Compare schools
        return profile.school == current_school

class SubjectResultWritePermission(permissions.BasePermission):
    message = 'এই সাবজেক্টে রেজাল্ট ইনপুট দেবার জন্য আপনি অনুমোদিত নন। দয়া করে আপনার প্রতিষ্ঠানের প্রধান শিক্ষক অথবা এ্যাডমিনের সাথে যোগাযোগ করুন।'
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if is_effective_admin(user):
            return True
            
        # For bulk_results action, we let the view's internal logic handle the per-subject permission check
        if getattr(view, 'action', None) == 'bulk_results':
            return True

        try:
            from academics.models import TeacherAssignment
            from results.models import Examination, Result
            subject_id = None
            classroom_id = None
            section_id = None
            if request.method == 'POST':
                subject_id = request.data.get('subject') or request.data.get('subject_id')
                exam_id = request.data.get('examination') or request.data.get('examination_id') or view.kwargs.get('pk')
                if not subject_id or not exam_id:
                    # If it's a POST to a list (like creating a single result), we need these
                    # But if it's an action, we might have already handled it
                    return False
                exam = Examination.objects.filter(id=exam_id).first()
                if not exam:
                    return False
                classroom_id = exam.classroom_id
                section_id = exam.section_id
            else:
                obj = getattr(view, 'get_object', None)
                target = obj() if callable(obj) else None
                if not target:
                    return False
                subject_id = getattr(target, 'subject_id', None)
                classroom_id = getattr(getattr(target, 'examination', None), 'classroom_id', None)
                section_id = getattr(getattr(target, 'examination', None), 'section_id', None)
            
            if not subject_id:
                return False

            # Strict subject, but section handling:
            from django.db.models import Q
            base = TeacherAssignment.objects.filter(teacher=user, subject_id=subject_id, classroom_id=classroom_id)
            if section_id is not None:
                return base.filter(Q(section_id=section_id) | Q(section__isnull=True)).exists()
            return base.exists()
        except Exception:
            return False

class TeacherSelfOrAdminChange(permissions.BasePermission):
    """
    Permission for Teacher profile editing:
    - Admin (Principal) can edit everything.
    - Teachers can edit their own profile.
    - Teachers can edit ANY student or parent profile (but this class is used for TeacherProfileViewSet).
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = getattr(request, 'user', None)
        if is_effective_admin(user):
            return True
        if not user or not user.is_authenticated:
            return False
        # If it's a POST, only admin can create new teachers (usually)
        if request.method == 'POST':
            return False
        return True

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = getattr(request, 'user', None)
        if is_effective_admin(user):
            return True
        
        # A teacher can edit their own profile
        try:
            # Check both Profile object and User object
            if hasattr(obj, 'user'):
                return obj.user_id == user.id
            return getattr(obj, 'id', None) == user.id
        except Exception:
            return False

class RolePermission(permissions.BasePermission):
    """
    Permission for Students, Parents, and Committee members:
    - Admin (Principal) can edit and delete everything.
    - Teachers can edit any student or parent.
    - Students, Parents, and Committee members can view everything (Read-Only) but can only edit their own profile.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if is_effective_admin(user):
            return True
            
        profile = getattr(user, 'profile', None)
        if not profile:
            return False
            
        # Teachers can create/edit students and parents (but usually not delete)
        if profile.role == 'teacher':
            return True
        
        # Other roles (student, parent, committee) can only edit their own objects (handled in has_object_permission)
        # However, for creating new objects, only admins and teachers should have access
        if request.method == 'POST':
            return False
            
        return True

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = getattr(request, 'user', None)
        if is_effective_admin(user):
            return True
            
        profile = getattr(user, 'profile', None)
        if not profile:
            return False
            
        # Teachers can edit students and parents
        if profile.role == 'teacher':
            # Check if target is student or parent
            target_role = getattr(obj, 'role', None)
            if not target_role and hasattr(obj, 'user'):
                # Try to get role from Profile if obj is StudentProfile/ParentProfile
                target_role = getattr(getattr(obj.user, 'profile', None), 'role', None)
            
            if target_role in ('student', 'parent'):
                # Teachers can edit but not delete
                if request.method == 'DELETE':
                    return False
                return True
        
        # All users (student, parent, committee) can edit their own profile/object
        try:
            # Check both Profile object and User object
            # If obj is a Profile/StudentProfile/ParentProfile, it has a .user or .user_id
            target_user_id = None
            if hasattr(obj, 'user_id'):
                target_user_id = obj.user_id
            elif hasattr(obj, 'user'):
                target_user_id = obj.user.id
            elif hasattr(obj, 'id'):
                # If obj is the User object itself
                target_user_id = obj.id
            
            if target_user_id == user.id:
                # User can edit their own data, but not delete
                if request.method == 'DELETE':
                    return False
                return True
        except Exception:
            pass
            
        return False

class TeacherSubjectResultPermission(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = getattr(request, 'user', None)
        if is_effective_admin(user):
            return True
        try:
            from academics.models import TeacherAssignment
            subject_id = getattr(obj, 'subject_id', None)
            classroom_id = getattr(getattr(obj, 'examination', None), 'classroom_id', None)
            section_id = getattr(getattr(obj, 'examination', None), 'section_id', None)
            from django.db.models import Q
            base = TeacherAssignment.objects.filter(teacher=user, subject_id=subject_id, classroom_id=classroom_id)
            if section_id is not None:
                return base.filter(Q(section_id=section_id) | Q(section__isnull=True)).exists()
            return base.exists()
        except Exception:
            return False
