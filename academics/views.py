from rest_framework import viewsets, filters, permissions
from rest_framework.exceptions import ValidationError
from users.permissions import AdminOrReadOnly, RolePermission, IsSchoolMember, is_global_admin, get_user_school_id
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.db.models import Q, Count, Sum
from rest_framework.pagination import PageNumberPagination
from django.contrib.auth import get_user_model
from backend.cache_utils import CachedListMixin

import re
import unicodedata
from .number_utils import bengali_to_english_number

PUNCT_RE = re.compile(r'[\s\-–—_()（）【】\[\]{}.,;:\'"!?।,|·•・/\\]+', re.UNICODE)

def _subject_semantic_key(name):
    if not name:
        return ''
    n = unicodedata.normalize('NFKC', str(name))
    n = n.replace('\u200d', '').replace('\u200c', '').strip().lower()
    return PUNCT_RE.sub('', n)

def _get_subject_weight(name):
    if not name:
        return 9999
    n = str(name).lower()
    if 'বাংলা' in n or 'bangla' in n:
        if 'বাংলাদেশ' in n or 'bgs' in n:
            return 60
        return 10
    if 'english' in n or 'ইংরেজি' in n or 'ইংরেজী' in n:
        return 20
    if 'গণিত' in n or 'math' in n:
        if 'উচ্চতর' in n or 'higher' in n:
            return 500
        return 30
    if 'ইসলাম' in n or 'islam' in n or 'ধর্ম' in n or 'religion' in n:
        return 40
    if 'আইসিটি' in n or 'ict' in n or 'তথ্য' in n:
        return 50
    if 'বাংলাদেশ' in n or 'বিশ্বপরিচয়' in n or 'bgs' in n or 'global studies' in n:
        return 60
    if 'পদার্থ' in n or 'physics' in n:
        return 70
    if 'রসায়ন' in n or 'chemistry' in n:
        return 80
    if 'জীব' in n or 'biology' in n:
        return 90
    if 'হিসাব' in n or 'accounting' in n:
        return 70
    if 'ফিন্যান্স' in n or 'finance' in n:
        return 80
    if 'ব্যবসায়' in n or 'business' in n:
        return 90
    if 'ইতিহাস' in n or 'history' in n:
        return 70
    if 'পৌরনীতি' in n or 'civics' in n:
        return 80
    if 'ভূগোল' in n or 'geography' in n:
        return 90
    if 'কৃষি' in n or 'agriculture' in n or 'গার্হস্থ্য' in n or 'home' in n:
        return 500
    return 200 + len(n)

User = get_user_model()

from schools.models import School
from .models import ClassRoom, Section, Subject, StudentProfile, TeacherAssignment, VirtualClass, Building, Room, ExamSeatPlan
from .serializers import (
    SchoolSerializer, ClassRoomSerializer, SectionSerializer,
    SubjectSerializer, StudentProfileSerializer, TeacherAssignmentSerializer,
    VirtualClassSerializer, BuildingSerializer, RoomSerializer, ExamSeatPlanSerializer
)

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 10000

class SchoolListAPI(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        schools = School.objects.all()
        serializer = SchoolSerializer(schools, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class ClassRoomViewSet(CachedListMixin, viewsets.ModelViewSet):
    queryset = ClassRoom.objects.all()
    serializer_class = ClassRoomSerializer
    permission_classes = [IsSchoolMember, RolePermission]
    cache_prefix = 'classrooms-list'

    def get_queryset(self):
        try:
            school_param = self.request.query_params.get('school') or self.request.query_params.get('school_id')
            sid = int(school_param) if (school_param and str(school_param).isdigit()) else get_user_school_id(self.request.user, self.request)

            if sid:
                return ClassRoom.objects.filter(school_id=sid).prefetch_related('sections').annotate(
                    annotated_student_count=Count('students', distinct=True)
                )

            if is_global_admin(self.request.user):
                return ClassRoom.objects.all().prefetch_related('sections').annotate(
                    annotated_student_count=Count('students', distinct=True)
                )
            return ClassRoom.objects.none()
        except Exception as e:
            print(f"ClassRoom Queryset Fatal Error: {e}")
            return ClassRoom.objects.none()

    def _list_uncached(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        # Performance optimization: Default DB sort
        queryset = queryset.order_by('name')

        # Logical sort using Python helper
        from .utils import get_class_order
        items = list(queryset)
        items.sort(key=lambda x: get_class_order(x.name))

        page = self.paginate_queryset(items)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(items, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        sid = get_user_school_id(request.user, request)
        if not sid: return Response([])
        classrooms = ClassRoom.objects.filter(school_id=sid).annotate(
            student_count_annotated=Count('students', distinct=True)
        )
        sub_count = Subject.objects.filter(school_id=sid).count()
        data = [{'id': c.id, 'name': c.name, 'student_count': getattr(c, 'student_count_annotated', 0), 'subject_count': sub_count} for c in classrooms]
        return Response(data)

    @action(detail=True, methods=['get'])
    def subjects(self, request, pk=None):
        classroom = self.get_object()
        section_id = request.query_params.get('section')
        
        # If section specified, get only subjects linked to that section OR classroom but with that section
        if section_id and section_id.isdigit():
            section = Section.objects.filter(id=int(section_id), classroom=classroom).first()
            if section:
                # Get subjects that are either linked directly to this section
                # OR linked to the classroom and not linked to any other sections
                subjects = Subject.objects.filter(
                    Q(sections__id=section.id) |
                    (Q(classrooms__id=classroom.id) & Q(sections__isnull=True))
                ).distinct()
            else:
                # If section doesn't exist, get all classroom subjects
                subjects = classroom.subjects.all()
        else:
            # If no section specified, get all subjects linked to classroom OR any of its sections
            subjects = Subject.objects.filter(
                Q(classrooms__id=classroom.id) |
                Q(sections__classroom__id=classroom.id)
            ).distinct()
        
        items = list(subjects)
        items.sort(key=lambda x: (_get_subject_weight(x.name), x.name))
        # Use SubjectSerializer with classroom and section context for assigned teachers
        serializer = SubjectSerializer(
            items,
            many=True, 
            context={
                'request': request,
                'classroom_id': classroom.id,
                'section_id': int(section_id) if section_id and section_id.isdigit() else None
            }
        )
        
        return Response(serializer.data)

class SectionViewSet(CachedListMixin, viewsets.ModelViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    permission_classes = [RolePermission]
    cache_prefix = 'sections-list'

    def get_queryset(self):
        school_param = self.request.query_params.get('school') or self.request.query_params.get('school_id')
        sid = int(school_param) if (school_param and str(school_param).isdigit()) else get_user_school_id(self.request.user, self.request)

        cid = self.request.query_params.get('classroom')

        if sid:
            qs = Section.objects.filter(classroom__school_id=sid).select_related('classroom')
            if cid and str(cid).isdigit():
                qs = qs.filter(classroom_id=int(cid))
            return qs

        if is_global_admin(self.request.user):
            qs = Section.objects.all().select_related('classroom')
            if cid and str(cid).isdigit():
                qs = qs.filter(classroom_id=int(cid))
            return qs

        return Section.objects.none()

    def _list_uncached(self, request, *args, **kwargs):
        from .utils import get_class_order, get_section_order
        queryset = self.filter_queryset(self.get_queryset())
        items = list(queryset)
        items.sort(key=lambda x: (
            get_class_order(x.classroom.name) if x.classroom else (999, 0, ''),
            get_section_order(x.name),
            x.name
        ))

        page = self.paginate_queryset(items)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(items, many=True)
        return Response(serializer.data)

class SubjectViewSet(CachedListMixin, viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsSchoolMember, AdminOrReadOnly]
    cache_prefix = 'subjects-list'

    def get_queryset(self):
        try:
            school_param = self.request.query_params.get('school') or self.request.query_params.get('school_id')
            sid = int(school_param) if (school_param and str(school_param).isdigit()) else get_user_school_id(self.request.user, self.request)

            if sid:
                qs = Subject.objects.filter(school_id=sid).select_related('school').prefetch_related('classrooms', 'sections', 'assignments', 'assignments__teacher')
            elif is_global_admin(self.request.user):
                qs = Subject.objects.all().select_related('school').prefetch_related('classrooms', 'sections', 'assignments', 'assignments__teacher')
            else:
                return Subject.objects.none()

            cid = self.request.query_params.get('classroom')
            sid_param = self.request.query_params.get('section')

            if cid and str(cid).isdigit():
                if sid_param and str(sid_param).isdigit():
                    qs = qs.filter(
                        Q(sections__id=int(sid_param)) |
                        (Q(classrooms__id=int(cid)) & Q(sections__isnull=True))
                    )
                else:
                    qs = qs.filter(
                        Q(classrooms__id=int(cid)) |
                        Q(sections__classroom_id=int(cid))
                    )
            return qs.distinct()
        except Exception as e:
            print(f"Subject Queryset Error: {e}")
            return Subject.objects.none()

    def _list_uncached(self, request, *args, **kwargs):
        try:
            queryset = self.filter_queryset(self.get_queryset())
            items = list(queryset)
            items.sort(key=lambda x: (_get_subject_weight(x.name), x.name))
            page = self.paginate_queryset(items)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            serializer = self.get_serializer(items, many=True)
            return Response(serializer.data)
        except Exception as e:
            import traceback
            print(f"Subject List Error: {e}")
            traceback.print_exc()
            return Response({"detail": str(e)}, status=500)

    def perform_create(self, serializer):
        sid = get_user_school_id(self.request.user, self.request)
        if not sid:
            raise ValidationError("School ID not found.")

        name = serializer.validated_data.get('name', '').strip()
        if not name:
            raise ValidationError({"name": "বিষয়ের নাম দিতে হবে।"})

        classroom_ids = serializer.validated_data.get('classrooms', [])
        if classroom_ids:
            valid_classrooms = ClassRoom.objects.filter(id__in=[c.id for c in classroom_ids], school_id=sid).count()
            if valid_classrooms != len(classroom_ids):
                raise ValidationError({"classrooms": "কিছু ক্লাসরুম এই স্কুলের অন্তর্গত নয়।"})

        section_ids = serializer.validated_data.get('sections', [])
        if section_ids:
            valid_sections = Section.objects.filter(id__in=[s.id for s in section_ids], classroom__school_id=sid).count()
            if valid_sections != len(section_ids):
                raise ValidationError({"sections": "কিছু শাখা এই স্কুলের অন্তর্গত নয়।"})

        school = School.objects.filter(pk=sid).first()
        if not school:
            raise ValidationError("School not found.")

        try:
            serializer.save(school=school, school_id=sid)
        except Exception as e:
            import traceback
            print(f"Subject Create Fatal Error: {e}")
            traceback.print_exc()
            raise ValidationError({"detail": f"বিষয় তৈরি করতে সমস্যা: {str(e)}"})

    def perform_update(self, serializer):
        sid = get_user_school_id(self.request.user, self.request)
        instance = serializer.instance

        classroom_ids = serializer.validated_data.get('classrooms', None)
        if classroom_ids is not None:
            valid_classrooms = ClassRoom.objects.filter(id__in=[c.id for c in classroom_ids], school_id=sid).count()
            if valid_classrooms != len(classroom_ids):
                raise ValidationError({"classrooms": "কিছু ক্লাসরুম এই স্কুলের অন্তর্গত নয়।"})

        section_ids = serializer.validated_data.get('sections', None)
        if section_ids is not None:
            valid_sections = Section.objects.filter(id__in=[s.id for s in section_ids], classroom__school_id=sid).count()
            if valid_sections != len(section_ids):
                raise ValidationError({"sections": "কিছু শাখা এই স্কুলের অন্তর্গত নয়।"})

        try:
            serializer.save()
        except Exception as e:
            import traceback
            print(f"Subject Update Fatal Error: {e}")
            traceback.print_exc()
            raise ValidationError({"detail": f"বিষয় আপডেট করতে সমস্যা: {str(e)}"})

    def perform_destroy(self, instance):
        """
        Explicit cascade destroy: delete ALL related data (Results, ExamSlots,
        TeacherAssignments, VirtualClasses, M2M links, optional_subject refs)
        before removing the Subject itself. Works even if the Subject has data
        entry because each step explicitly clears references.
        """
        from django.db.models.deletion import ProtectedError
        from academics.models import TeacherAssignment, VirtualClass, StudentProfile
        from results.models import Result, ExamSlot

        try:
            with transaction.atomic():
                subject_id = instance.id
                school_id = getattr(instance, 'school_id', None)

                # 1) Delete all Result rows that point to this Subject
                res_del = Result.objects.filter(subject_id=subject_id).delete()
                print(f"[SubjectDestroy] Deleted {res_del[0]} Result rows for subject#{subject_id}")

                # 2) Delete all ExamSlot rows that point to this Subject
                es_del = ExamSlot.objects.filter(subject_id=subject_id).delete()
                print(f"[SubjectDestroy] Deleted {es_del[0]} ExamSlot rows for subject#{subject_id}")

                # 3) Delete all TeacherAssignment rows that point to this Subject
                ta_del = TeacherAssignment.objects.filter(subject_id=subject_id).delete()
                print(f"[SubjectDestroy] Deleted {ta_del[0]} TeacherAssignment rows for subject#{subject_id}")

                # 4) Delete all VirtualClass rows that point to this Subject
                vc_del = VirtualClass.objects.filter(subject_id=subject_id).delete()
                print(f"[SubjectDestroy] Deleted {vc_del[0]} VirtualClass rows for subject#{subject_id}")

                # 5) Unlink StudentProfile.optional_subject references
                sp_count = StudentProfile.objects.filter(optional_subject_id=subject_id).update(optional_subject=None)
                print(f"[SubjectDestroy] Unlinked {sp_count} StudentProfile optional_subject refs")

                # 6) Clear M2M relations (classrooms, sections)
                try:
                    instance.classrooms.clear()
                    instance.sections.clear()
                except Exception as m2m_err:
                    print(f"[SubjectDestroy] M2M clear warning: {m2m_err}")

                # 7) Finally delete the Subject instance itself
                instance.delete()
                print(f"[SubjectDestroy] Subject #{subject_id} fully deleted with all related data.")
        except ProtectedError as pe:
            import traceback
            traceback.print_exc()
            raise ValidationError({
                "detail": (
                    f"বিষয়টি মুছতে পারছি না কারণ এর সাথে সংযুক্ত অন্য ডাটা আছে: "
                    f"{len(getattr(pe, 'protected_objects', []))} items. "
                    "অ্যাডমিনকে যোগাযোগ করুন।"
                )
            })
        except Exception as e:
            import traceback
            print(f"[SubjectDestroy] Fatal error during destroy: {type(e).__name__}: {e}")
            traceback.print_exc()
            raise ValidationError({"detail": f"বিষয় মুছতে সমস্যা হয়েছে: {str(e)}"})

    def destroy(self, request, *args, **kwargs):
        """
        Overridden destroy: fetch Subject ONLY by (pk + school_id) without
        applying the extra classroom/section filters that are used in the
        list queryset. This prevents 404 "No Subject matches the given query"
        errors when the user deletes a subject that was loaded from a
        classroom-scoped or section-scoped list view.
        """
        from rest_framework.generics import get_object_or_404

        sid = get_user_school_id(request.user, request)
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        pk = kwargs.get(lookup_url_kwarg, None)

        try:
            if not sid and not is_global_admin(request.user):
                return Response(
                    {"detail": "School not determined for current user."},
                    status=status.HTTP_403_FORBIDDEN
                )

            if is_global_admin(request.user) and not sid:
                # Global admin can delete any subject by PK
                base_qs = Subject.objects.all()
            else:
                base_qs = Subject.objects.filter(school_id=sid)

            # Fetch by pk ONLY, no classroom/section filter
            instance = get_object_or_404(base_qs, pk=pk)
            self.check_object_permissions(request, instance)
            self.perform_destroy(instance)
            return Response(
                {"detail": "Subject and all related data deleted successfully.", "id": pk},
                status=status.HTTP_200_OK
            )
        except ValidationError as ve:
            return Response(
                {"detail": ve.detail if hasattr(ve, 'detail') else str(ve)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {"detail": f"বিষয় মুছতে সমস্যা হয়েছে: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class StudentProfileViewSet(CachedListMixin, viewsets.ModelViewSet):
    queryset = StudentProfile.objects.all()
    serializer_class = StudentProfileSerializer
    permission_classes = [IsSchoolMember, RolePermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = StandardResultsSetPagination
    cache_prefix = 'students-list'

    @classmethod
    def birth_date_db_exists(cls):
        return True

    def perform_create(self, serializer):
        instance = serializer.save()
        try:
            from users.utils import log_activity, get_client_ip
            full_name = instance.user.get_full_name() if instance.user else ''
            if not full_name and instance.user:
                full_name = instance.user.username

            log_activity(
                user=self.request.user,
                school=instance.school,
                action_type='student_create',
                details={
                    'action': 'student_create',
                    'action_label': 'নতুন শিক্ষার্থী ভর্তি/যোগ',
                    'name': full_name,
                    'roll': instance.roll_number,
                    'class': instance.classroom.name if instance.classroom else '',
                    'section': instance.section.name if instance.section else '',
                    'role': 'student'
                },
                cost=5.00,
                ip_address=get_client_ip(self.request)
            )
        except Exception as e:
            print(f"Error logging student_create activity: {e}")

    def perform_update(self, serializer):
        instance = serializer.save()
        try:
            from users.utils import log_activity, get_client_ip
            full_name = instance.user.get_full_name() if instance.user else ''
            if not full_name and instance.user:
                full_name = instance.user.username

            log_activity(
                user=self.request.user,
                school=instance.school,
                action_type='student_edit',
                details={
                    'action': 'student_edit',
                    'action_label': 'শিক্ষার্থীর তথ্য পরিবর্তন/আপডেট',
                    'name': full_name,
                    'roll': instance.roll_number,
                    'class': instance.classroom.name if instance.classroom else '',
                    'section': instance.section.name if instance.section else '',
                    'role': 'student'
                },
                cost=0.00,
                ip_address=get_client_ip(self.request)
            )
        except Exception as e:
            print(f"Error logging student_edit activity: {e}")

    def perform_destroy(self, instance):
        """
        Custom delete to ensure the associated User object is also removed.
        This provides a complete cleanup of the student account.
        """
        try:
            from users.utils import log_activity, get_client_ip
            full_name = instance.user.get_full_name() if instance.user else ''
            if not full_name and instance.user:
                full_name = instance.user.username

            log_activity(
                user=self.request.user,
                school=instance.school,
                action_type='student_delete',
                details={
                    'action': 'student_delete',
                    'action_label': 'শিক্ষার্থী মুছে ফেলা হয়েছে (ডিলেট)',
                    'name': full_name,
                    'roll': instance.roll_number,
                    'class': instance.classroom.name if instance.classroom else '',
                    'section': instance.section.name if instance.section else '',
                    'role': 'student'
                },
                cost=0.00,
                ip_address=get_client_ip(self.request)
            )
        except Exception as e:
            print(f"Error logging student_delete activity: {e}")

        user = instance.user
        # Deleting the user will cascade and delete the StudentProfile
        # and all its related records (Results, Attendance, etc.)
        if user:
            user.delete()
        else:
            instance.delete()

    def get_serializer_class(self):
        return StudentProfileSerializer

    def get_queryset(self):
        try:
            sid = get_user_school_id(self.request.user, self.request)
            # Default select_related for details
            queryset = StudentProfile.objects.select_related('user', 'classroom', 'section', 'school')
            
            # Optimization: If it's a list request, don't fetch family members unless explicitly needed
            # (Family members are heavy to serialize and join)
            if self.action != 'list':
                queryset = queryset.select_related('guardian', 'father', 'mother')

            # নির্দিষ্ট শিক্ষার্থীদের আইডি দিয়ে আনা (যেমন দৈনিক আদায় রেজিস্ট্রারে পেজিনেশনের সীমাবদ্ধতা এড়াতে)
            ids_param = self.request.query_params.get('ids')
            if ids_param:
                ids = [int(x) for x in str(ids_param).split(',') if str(x).strip().isdigit()]
                if ids:
                    queryset = queryset.filter(id__in=ids)

            if not sid:
                if is_global_admin(self.request.user):
                    return queryset
                return StudentProfile.objects.none()

            queryset = queryset.filter(school_id=sid)

            p = self.request.query_params
            cid = p.get('classroom')
            secid_param = p.getlist('section') or p.get('section')
            group = p.get('group')
            search = p.get('search')
            roll = p.get('roll')

            if cid and str(cid).isdigit():
                queryset = queryset.filter(classroom_id=int(cid))

            if roll:
                # Normalizing roll number (Convert Bengali to English)
                roll = bengali_to_english_number(str(roll).strip())
                clean_roll = re.sub(r'\s+', '', roll)

                # Use iexact for roll_number to avoid loose partial matches (e.g. 3 matching 63)
                queryset = queryset.filter(
                    Q(roll_number__iexact=roll) |
                    Q(ssc_roll__iexact=roll) |
                    Q(student_custom_id__iexact=roll) |
                    Q(roll_number__iexact=clean_roll) |
                    Q(ssc_roll__iexact=clean_roll)
                )

            if search:
                # Normalizing search (Convert Bengali to English if it looks like a number)
                search = bengali_to_english_number(str(search).strip())
                # Remove potential zero-width characters or extra spaces
                clean_search = ''.join(c for c in str(search) if not (0x200B <= ord(c) <= 0x200D or ord(c) == 0xFEFF)).strip()

                queryset = queryset.filter(
                    Q(user__first_name__icontains=clean_search) |
                    Q(user__last_name__icontains=clean_search) |
                    Q(user__first_name_en__icontains=clean_search) |
                    Q(user__last_name_en__icontains=clean_search) |
                    Q(roll_number__iexact=clean_search) |
                    Q(ssc_roll__iexact=clean_search)
                )

            if secid_param:
                if isinstance(secid_param, str):
                    sec_ids = [s.strip() for s in secid_param.split(',') if s.strip()]
                else:
                    sec_ids = [str(s) for s in secid_param if str(s).strip()]

                digit_ids = [int(s) for s in sec_ids if s.isdigit()]
                name_queries = [s for s in sec_ids if not s.isdigit() and s.lower() not in ['science', 'arts', 'commerce', 'humanities']]
                group_names = [s.lower() for s in sec_ids if not s.isdigit() and s.lower() in ['science', 'arts', 'commerce', 'humanities']]

                q_filter = Q()
                if digit_ids:
                    q_filter |= Q(section_id__in=digit_ids)

                if name_queries:
                    sec_name_query = Q()
                    for name_q in name_queries:
                        sec_name_query |= Q(section__name__iexact=name_q)
                    if cid and str(cid).isdigit():
                        sec_name_query &= Q(section__classroom_id=int(cid))
                    else:
                        sec_name_query &= Q(section__classroom__school_id=sid)
                    q_filter |= sec_name_query

                if group_names:
                    q_filter |= Q(student_group__in=group_names)

                if q_filter:
                    queryset = queryset.filter(q_filter)

            if group:
                group_str = str(group).lower().strip()
                if group_str in ['arts', 'humanities', 'মানবিক']:
                    queryset = queryset.filter(
                        Q(student_group__in=['arts', 'humanities', 'মানবিক']) |
                        (Q(student_group__isnull=True) | Q(student_group='')) & (Q(section__name__icontains='মানবিক') | Q(section__name__icontains='arts') | Q(section__name__icontains='humanities'))
                    )
                elif group_str in ['commerce', 'business', 'ব্যবসায়', 'ব্যবসায়']:
                    queryset = queryset.filter(
                        Q(student_group__in=['commerce', 'business', 'ব্যবসায়', 'ব্যবসায়']) |
                        (Q(student_group__isnull=True) | Q(student_group='')) & (Q(section__name__icontains='ব্যবসায়') | Q(section__name__icontains='commerce') | Q(section__name__icontains='business'))
                    )
                elif group_str in ['science', 'বিজ্ঞান']:
                    queryset = queryset.filter(
                        Q(student_group__in=['science', 'বিজ্ঞান']) |
                        (Q(student_group__isnull=True) | Q(student_group='')) & (Q(section__name__icontains='বিজ্ঞান') | Q(section__name__icontains='science'))
                    )

            # Performance: Use a simpler ordering that index can handle if possible
            # Standard database indices work best on simple field ordering
            return queryset.order_by('roll_number', 'id')
        except Exception as e:
            print(f"Student Queryset Error: {e}")
            return StudentProfile.objects.none()

    def get_object(self):
        obj = StudentProfile.objects.select_related('user', 'classroom', 'section', 'guardian', 'school', 'father', 'mother').get(pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, obj)
        return obj

    def _list_uncached(self, request, *args, **kwargs):
        try:
            queryset = self.filter_queryset(self.get_queryset())

            # Optimization: Use built-in pagination and serialization
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            import traceback
            print(f"Student List View Error: {e}")
            traceback.print_exc()
            return Response(
                {"detail": "শিক্ষার্থী তালিকা লোড করতে সমস্যা হয়েছে।", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def bulk_update_students(self, request):
        sid = get_user_school_id(request.user, request)
        updates = request.data.get('updates', [])

        if not sid and 'school' in request.data:
            sid = request.data.get('school')

        if not sid or not updates:
            return Response({"detail": "School ID or updates missing"}, status=400)

        updated_count = 0
        failed_updates = []
        birth_date_exists = self.birth_date_db_exists()

        try:
            student_ids = [u.get('id') for u in updates if u.get('id')]
            student_map = {
                s.id: s for s in StudentProfile.objects.filter(id__in=student_ids, school_id=sid).select_related('user')
            }

            for data in updates:
                student_id = data.get('id')
                if not student_id: continue

                instance = student_map.get(student_id)
                if not instance:
                    failed_updates.append({"id": student_id, "error": "Student not found"})
                    continue

                try:
                    with transaction.atomic():
                        # 1. Update User model (only if fields actually changed)
                        user_changed = False
                        user_fields = ['first_name', 'last_name', 'first_name_en', 'last_name_en', 'phone_number', 'email']
                        if instance.user:
                            for field in user_fields:
                                if field in data and getattr(instance.user, field) != data[field]:
                                    setattr(instance.user, field, data[field])
                                    user_changed = True
                            if user_changed:
                                instance.user.save()

                        # 2. Update StudentProfile
                        profile_fields = ['father_name', 'mother_name', 'guardian_name', 'address', 'address_en', 'admission_date', 'birth_date', 'roll_number', 'student_group', 'blood_group', 'gender', 'subjects_list', 'voter_number', 'remarks', 'optional_subject_id', 'section_id', 'ssc_board', 'ssc_roll', 'ssc_registration', 'ssc_session', 'ssc_gpa']
                        safe_data = {}
                        profile_changed = False

                        for field in profile_fields:
                            val = data.get(field)
                            if field == 'student_group' and val is None:
                                val = data.get('group')

                            if field == 'birth_date' and not birth_date_exists:
                                continue

                            if val is not None and getattr(instance, field) != val:
                                safe_data[field] = val
                                profile_changed = True

                        if profile_changed or user_changed:
                            # Set skip flag for performance during bulk update if only user fields changed
                            # But names_changed logic in model already handles this.
                            serializer = self.get_serializer(instance, data=safe_data, partial=True)
                            if serializer.is_valid():
                                serializer.save()
                                updated_count += 1
                            else:
                                failed_updates.append({"id": student_id, "error": serializer.errors})
                except Exception as row_err:
                    failed_updates.append({"id": student_id, "error": str(row_err)})

            return Response({
                "status": "success" if not failed_updates else "partial_success",
                "updated": updated_count,
                "failed": failed_updates
            })
        except Exception as e:
            return Response({"detail": f"Fatal error during bulk update: {str(e)}"}, status=500)

    @action(detail=False, methods=['post'], url_path='auto-generate')
    def auto_generate(self, request):
        """
        Auto-generates N students for a specific classroom and section where roll and name are 1, 2, 3...
        Request payload:
        {
            "classroom_id": 211,
            "section_id": 470,
            "count": 50
        }
        """
        school_param = request.query_params.get('school') or request.query_params.get('school_id') or request.data.get('school') or request.data.get('school_id')
        sid = int(school_param) if (school_param and str(school_param).isdigit()) else get_user_school_id(request.user, request)
        if not sid:
            return Response({"detail": "School ID required"}, status=400)

        classroom_id = request.data.get('classroom_id')
        section_id = request.data.get('section_id')
        count = request.data.get('count')

        if not classroom_id or not section_id or not count:
            return Response({"detail": "classroom_id, section_id, and count are required"}, status=400)

        try:
            count = int(count)
            classroom_id = int(classroom_id)
            section_id = int(section_id)
        except ValueError:
            return Response({"detail": "Invalid parameters"}, status=400)

        school = School.objects.filter(pk=sid).first()
        classroom = ClassRoom.objects.filter(pk=classroom_id, school_id=sid).first()
        section = Section.objects.filter(pk=section_id, classroom_id=classroom_id).first()

        if not school or not classroom or not section:
            return Response({"detail": "School, classroom, or section not found"}, status=404)

        created_count = 0
        from users.models import User, Profile

        with transaction.atomic():
            for roll in range(1, count + 1):
                roll_str = str(roll)
                if StudentProfile.objects.filter(school=school, classroom=classroom, section=section, roll_number=roll_str).exists():
                    continue

                base_uname = f"s{sid}c{classroom_id}s{section_id}r{roll}"
                uname = base_uname
                c = 1
                while User.objects.filter(username=uname).exists():
                    uname = f"{base_uname}_{c}"
                    c += 1

                user = User.objects.create_user(
                    username=uname,
                    password="12345678",
                    first_name=roll_str,
                    last_name=""
                )

                Profile.objects.update_or_create(
                    user=user,
                    defaults={'school': school, 'role': 'student'}
                )

                StudentProfile.objects.create(
                    user=user,
                    school=school,
                    classroom=classroom,
                    section=section,
                    roll_number=roll_str
                )
                created_count += 1

        return Response({
            "status": "success",
            "created_count": created_count,
            "message": f"Successfully auto-generated {created_count} students."
        })

    @action(detail=False, methods=['get'])
    def history(self, request):
        sid = get_user_school_id(request.user, request)
        year = request.query_params.get('year')
        student_id = request.query_params.get('student_id')

        if not sid:
            return Response({"detail": "School ID required"}, status=400)

        # Return current profile as history fallback
        qs = StudentProfile.objects.filter(school_id=sid)
        if student_id:
            qs = qs.filter(pk=student_id)

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def year_report(self, request):
        """Generates a summary report of students for a specific year."""
        sid = get_user_school_id(request.user, request)
        year = request.query_params.get('year')
        classroom_id = request.query_params.get('classroom')
        section_id = request.query_params.get('section')

        if not sid or not year:
            return Response({"error": "School ID and Year are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Filter students by school
            queryset = StudentProfile.objects.filter(school_id=sid).select_related('classroom', 'section', 'user')

            if classroom_id:
                queryset = queryset.filter(classroom_id=classroom_id)
            if section_id:
                queryset = queryset.filter(section_id=section_id)

            # In a real app, we would join with overall results table for the specific year
            # For now, we return basic student info with placeholders for result data
            from results.models import StudentOverallResult

            records = []
            total_students = queryset.count()
            promoted = 0
            retained = 0
            not_passed = 0
            sum_gpa = 0.0
            gpa_count = 0

            # Get overall results for these students in the given year
            overall_results = {
                r.student_id: r for r in StudentOverallResult.objects.filter(
                    student__school_id=sid,
                    academic_year=year
                )
            }

            for student in queryset:
                res = overall_results.get(student.id)
                status_val = 'N/A'
                gpa = None
                grade = None

                if res:
                    gpa = float(res.cgpa or 0)
                    grade = res.grade
                    status_val = 'promoted' if gpa >= 1.0 else 'not_passed'

                    if status_val == 'promoted': promoted += 1
                    elif status_val == 'not_passed': not_passed += 1

                    sum_gpa += gpa
                    gpa_count += 1
                else:
                    retained += 1 # Default to retained if no result found for that year

                records.append({
                    "id": student.id,
                    "student_name": f"{student.user.first_name} {student.user.last_name}".strip(),
                    "roll_number": student.roll_number,
                    "classroom": student.classroom.name if student.classroom else None,
                    "section": student.section.name if student.section else None,
                    "status": status_val,
                    "result_cgpa": gpa,
                    "result_grade": grade,
                    "percentage": res.percentage if res else None,
                    "rank": res.rank if res else None
                })

            summary = {
                "total": total_students,
                "promoted": promoted,
                "retained": retained,
                "not_passed": not_passed,
                "avg_cgpa": round(sum_gpa / gpa_count, 2) if gpa_count > 0 else None,
            }

            return Response({
                "summary": summary,
                "records": records
            })
        except Exception as e:
            import traceback
            print(traceback.format_exc())
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class TeacherAssignmentViewSet(viewsets.ModelViewSet):
    queryset = TeacherAssignment.objects.all()
    serializer_class = TeacherAssignmentSerializer
    permission_classes = [IsSchoolMember, AdminOrReadOnly]

    def get_queryset(self):
        sid = get_user_school_id(self.request.user, self.request)
        if not sid:
            if is_global_admin(self.request.user):
                return TeacherAssignment.objects.all().select_related('teacher','subject','classroom','section')
            return TeacherAssignment.objects.none()

        qs = TeacherAssignment.objects.filter(classroom__school_id=sid).select_related('teacher','subject','classroom','section')
        tid = self.request.query_params.get('teacher')
        if tid:
            # Handle both User ID and Profile ID for robust filtering
            qs = qs.filter(Q(teacher_id=tid) | Q(teacher__profile__id=tid))
        return qs

    @action(detail=False, methods=['post'])
    def bulk_assign(self, request):
        teacher_id = request.data.get('teacher_id')
        school_id = request.data.get('school_id')
        assignments_data = request.data.get('assignments', [])

        if not teacher_id or not school_id:
            return Response({'detail': 'teacher_id and school_id are required'}, status=400)

        # Robustly identify teacher from User ID or Profile ID
        teacher = User.objects.filter(pk=teacher_id).first()
        if not teacher:
            from users.models import Profile
            profile = Profile.objects.filter(pk=teacher_id).first()
            if profile:
                teacher = profile.user

        if not teacher:
            return Response({'detail': 'Teacher user not found with provided ID'}, status=404)

        with transaction.atomic():
            # Delete old assignments for this teacher in this school
            TeacherAssignment.objects.filter(
                teacher=teacher,
                classroom__school_id=school_id
            ).delete()

            created_count = 0
            for data in assignments_data:
                subject_id = data.get('subject_id')
                pairs = data.get('pairs', [])

                subject = Subject.objects.filter(pk=subject_id, school_id=school_id).first()
                if not subject:
                    continue

                for pair in pairs:
                    cid = pair.get('classroom_id')
                    sid = pair.get('section_id')

                    if not cid:
                        continue

                    TeacherAssignment.objects.create(
                        teacher=teacher,
                        subject=subject,
                        classroom_id=cid,
                        section_id=sid if sid else None
                    )
                    created_count += 1

        return Response({
            'success': True,
            'assigned': created_count
        })

class VirtualClassViewSet(viewsets.ModelViewSet):
    queryset = VirtualClass.objects.all()
    serializer_class = VirtualClassSerializer
    permission_classes = [IsSchoolMember, RolePermission]

    def get_queryset(self):
        sid = get_user_school_id(self.request.user, self.request)
        if not sid:
            if is_global_admin(self.request.user):
                return VirtualClass.objects.all().select_related('teacher', 'classroom', 'section', 'subject')
            return VirtualClass.objects.none()

        # Global admin viewing everything
        if is_global_admin(self.request.user) and not sid:
            qs = VirtualClass.objects.all().select_related('teacher', 'classroom', 'section', 'subject')
        else:
            qs = VirtualClass.objects.filter(school_id=sid).select_related('teacher', 'classroom', 'section', 'subject')

        active = self.request.query_params.get('active')
        if active == 'true':
            qs = qs.filter(is_active=True)
        elif active == 'false':
            qs = qs.filter(is_active=False)

        return qs.order_by('-started_at')

    def perform_create(self, serializer):
        import uuid
        mid = f"sch{serializer.validated_data['school'].id}-{uuid.uuid4().hex[:10]}"
        serializer.save(teacher=self.request.user, is_active=True, meeting_id=mid)

    @action(detail=True, methods=['post'])
    def end_class(self, request, pk=None):
        from django.utils import timezone
        instance = self.get_object()
        instance.is_active = False
        instance.ended_at = timezone.now()
        instance.save()
        return Response({'status': 'class ended'})

class BuildingViewSet(viewsets.ModelViewSet):
    queryset = Building.objects.all()
    serializer_class = BuildingSerializer
    permission_classes = [IsSchoolMember, AdminOrReadOnly]
    def get_queryset(self):
        sid = get_user_school_id(self.request.user, self.request)
        qs = Building.objects.all()
        if sid:
            qs = qs.filter(school_id=sid)
        elif not is_global_admin(self.request.user):
            return Building.objects.none()

        school_param = self.request.query_params.get('school')
        if school_param:
            qs = qs.filter(school_id=school_param)

        return qs

    @action(detail=False, methods=['post'], url_path='bulk-setup')
    def bulk_setup(self, request):
        sid = get_user_school_id(request.user, request)
        if not sid: return Response({"detail": "School not found"}, status=400)
        school = School.objects.get(pk=sid)

        buildings_config = request.data
        if not isinstance(buildings_config, list):
            # If it's wrapped in an object
            buildings_config = request.data.get('buildings', [])

        from .utils import generate_exam_buildings_and_rooms
        try:
            rooms = generate_exam_buildings_and_rooms(school, buildings_config)
            return Response({"status": "success", "room_count": len(rooms)})
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsSchoolMember, AdminOrReadOnly]
    def get_queryset(self):
        sid = get_user_school_id(self.request.user, self.request)
        qs = Room.objects.all().select_related('building')
        if sid:
            qs = qs.filter(building__school_id=sid)
        elif not is_global_admin(self.request.user):
            return Room.objects.none()

        building_param = self.request.query_params.get('building')
        if building_param:
            qs = qs.filter(building_id=building_param)

        return qs

class ExamSeatPlanViewSet(viewsets.ModelViewSet):
    queryset = ExamSeatPlan.objects.all()
    serializer_class = ExamSeatPlanSerializer
    permission_classes = [IsSchoolMember, AdminOrReadOnly]
    def get_queryset(self):
        sid = get_user_school_id(self.request.user, self.request)
        if not sid:
            if is_global_admin(self.request.user):
                return ExamSeatPlan.objects.all()
            return ExamSeatPlan.objects.none()

        # Global admin viewing everything
        if is_global_admin(self.request.user) and not sid:
            return ExamSeatPlan.objects.all()

        return ExamSeatPlan.objects.filter(school_id=sid)

class ImportStudentsAPI(APIView):
    permission_classes = [IsSchoolMember, AdminOrReadOnly]
    def post(self, request): return Response({"detail": "Restored"})

class UpdateStudentGendersAPI(APIView):
    permission_classes = [IsSchoolMember, AdminOrReadOnly]
    def post(self, request): return Response({"detail": "Restored"})

class GenerateExamSeatPlanAPI(APIView):
    permission_classes = [IsSchoolMember, AdminOrReadOnly]
    def post(self, request):
        exam_id = request.data.get('examination_id')
        school_id = request.data.get('school_id') or get_user_school_id(request.user, request)
        buildings_config = request.data.get('buildings', [])
        classroom_ids = request.data.get('classroom_ids', [])

        if not exam_id or not school_id:
            return Response({"detail": "examination_id and school_id are required"}, status=400)

        try:
            from .models import School, ExamSeatPlan
            from results.models import Examination
            from .serializers import ExamSeatPlanSerializer
            from .utils import generate_exam_seat_plan

            school = School.objects.get(pk=school_id)
            examination = Examination.objects.get(pk=exam_id)

            plans = generate_exam_seat_plan(
                examination=examination,
                school=school,
                buildings_config=buildings_config,
                selected_classroom_ids=classroom_ids if classroom_ids else None
            )

            serializer = ExamSeatPlanSerializer(plans, many=True)
            return Response({"status": "success", "seat_plans": serializer.data})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"detail": str(e)}, status=400)
