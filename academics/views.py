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
    max_page_size = 1000

class SchoolListAPI(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        schools = School.objects.all()
        serializer = SchoolSerializer(schools, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class ClassRoomViewSet(viewsets.ModelViewSet):
    queryset = ClassRoom.objects.all()
    serializer_class = ClassRoomSerializer
    permission_classes = [IsSchoolMember, RolePermission]

    def get_queryset(self):
        try:
            sid = get_user_school_id(self.request.user, self.request)
            if not sid:
                if is_global_admin(self.request.user):
                    return ClassRoom.objects.all().prefetch_related('sections').annotate(
                        annotated_student_count=Count('students', distinct=True)
                    ).order_by('name')
                return ClassRoom.objects.none()

            try:
                # Intelligent sorting: First by length, then by value
                from django.db.models.functions import Length
                return ClassRoom.objects.filter(school_id=sid).prefetch_related('sections').annotate(
                    annotated_student_count=Count('students', distinct=True),
                    name_len=Length('name')
                ).order_by('name_len', 'name')
            except Exception as e:
                print(f"ClassRoom Queryset Sorting Error: {e}")
                return ClassRoom.objects.filter(school_id=sid).prefetch_related('sections').annotate(
                    annotated_student_count=Count('students', distinct=True)
                ).order_by('name')
        except Exception as e:
            print(f"ClassRoom Queryset Fatal Error: {e}")
            return ClassRoom.objects.none()

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
        
        # Use SubjectSerializer with classroom and section context for assigned teachers
        serializer = SubjectSerializer(
            subjects, 
            many=True, 
            context={
                'request': request,
                'classroom_id': classroom.id,
                'section_id': int(section_id) if section_id and section_id.isdigit() else None
            }
        )
        
        return Response(serializer.data)

class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    permission_classes = [RolePermission]

    def get_queryset(self):
        sid = get_user_school_id(self.request.user, self.request)
        if not sid:
            if is_global_admin(self.request.user):
                return Section.objects.all().select_related('classroom')
            return Section.objects.none()

        qs = Section.objects.filter(classroom__school_id=sid).select_related('classroom')
        cid = self.request.query_params.get('classroom')
        if cid and str(cid).isdigit():
            qs = qs.filter(classroom_id=int(cid))
        return qs

class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsSchoolMember, AdminOrReadOnly]

    def get_queryset(self):
        try:
            sid = get_user_school_id(self.request.user, self.request)
            if not sid: return Subject.objects.none()

            qs = Subject.objects.filter(school_id=sid).select_related('school').prefetch_related('classrooms', 'sections', 'assignments', 'assignments__teacher')
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

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            import traceback
            print(f"Subject List Error: {e}")
            traceback.print_exc()
            return Response({"detail": str(e)}, status=500)

    def perform_create(self, serializer):
        sid = get_user_school_id(self.request.user, self.request)
        if not sid:
            raise ValidationError("School ID not found.")
        serializer.save(school_id=sid)

class StudentProfileViewSet(viewsets.ModelViewSet):
    queryset = StudentProfile.objects.all()
    serializer_class = StudentProfileSerializer
    permission_classes = [IsSchoolMember, RolePermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = StandardResultsSetPagination

    # Check if birth_date exists in database once per app startup
    _birth_date_db_exists = None
    
    @classmethod
    def birth_date_db_exists(cls):
        if cls._birth_date_db_exists is None:
            try:
                from django.db import connection
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1 FROM information_schema.columns WHERE table_name = 'academics_studentprofile' AND column_name = 'birth_date'")
                    cls._birth_date_db_exists = cursor.fetchone() is not None
            except Exception:
                cls._birth_date_db_exists = False
        return cls._birth_date_db_exists

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

            if not sid:
                if is_global_admin(self.request.user):
                    return queryset
                return StudentProfile.objects.none()

            queryset = queryset.filter(school_id=sid)

            p = self.request.query_params
            cid = p.get('classroom')
            secid_param = p.getlist('section') or p.get('section')
            group = p.get('group')

            if cid and str(cid).isdigit():
                queryset = queryset.filter(classroom_id=int(cid))

            if secid_param:
                if isinstance(secid_param, str):
                    sec_ids = [s.strip() for s in secid_param.split(',') if s.strip()]
                else:
                    sec_ids = [str(s) for s in secid_param if str(s).strip()]

                digit_ids = [int(s) for s in sec_ids if s.isdigit()]
                group_names = [s.lower() for s in sec_ids if not s.isdigit() and s.lower() in ['science', 'arts', 'commerce']]

                q_filter = Q()
                if digit_ids:
                    sections = Section.objects.filter(id__in=digit_ids)
                    for section in sections:
                        name = section.name.lower()
                        if 'বিজ্ঞান' in name or 'science' in name:
                            q_filter |= Q(section_id=section.id) | Q(student_group='science')
                        elif 'মানবিক' in name or 'arts' in name:
                            q_filter |= Q(section_id=section.id) | Q(student_group='arts')
                        elif 'ব্যবসায় শিক্ষা' in name or 'commerce' in name or 'ব্যবসা' in name:
                            q_filter |= Q(section_id=section.id) | Q(student_group='commerce')
                        else:
                            q_filter |= Q(section_id=section.id)

                if group_names:
                    q_filter |= Q(student_group__in=group_names)

                if q_filter:
                    queryset = queryset.filter(q_filter)

            if group:
                queryset = queryset.filter(student_group=group)

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

    def list(self, request, *args, **kwargs):
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
        birth_date_exists = self.birth_date_db_exists()

        try:
            with transaction.atomic():
                # Pre-fetch students and users to avoid N+1 in the loop
                student_ids = [u.get('id') for u in updates if u.get('id')]
                student_map = {
                    s.id: s for s in StudentProfile.objects.filter(id__in=student_ids, school_id=sid).select_related('user')
                }

                for data in updates:
                    student_id = data.get('id')
                    if not student_id: continue
                    
                    instance = student_map.get(student_id)
                    if instance:
                        # 1. Update User model (only if fields actually changed)
                        user_changed = False
                        user_fields = ['first_name', 'last_name', 'phone_number', 'email']
                        if instance.user:
                            for field in user_fields:
                                if field in data and getattr(instance.user, field) != data[field]:
                                    setattr(instance.user, field, data[field])
                                    user_changed = True
                            if user_changed:
                                instance.user.save()

                        # 2. Update StudentProfile fields
                        profile_fields = ['father_name', 'mother_name', 'guardian_name', 'address', 'admission_date', 'birth_date', 'roll_number', 'student_group', 'blood_group', 'gender', 'subjects_list', 'voter_number', 'remarks']
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

                        if profile_changed:
                            # Use serializer for validation and saving profile fields
                            # This will trigger instance.save() and our optimized parent logic
                            serializer = self.get_serializer(instance, data=safe_data, partial=True)
                            if serializer.is_valid():
                                try:
                                    serializer.save()
                                    updated_count += 1
                                except Exception as e:
                                    # Handle duplicate student_custom_id or other DB errors
                                    if "duplicate key" in str(e) and "student_custom_id" in str(e):
                                        raise ValidationError({
                                            "detail": f"Custom ID collision for student {instance.user.get_full_name()}. "
                                                      f"Ensure roll number {data.get('roll_number', instance.roll_number)} is unique in this class."
                                        })
                                    raise e
                            else:
                                raise ValidationError(serializer.errors)

            return Response({"status": "success", "updated": updated_count})
        except ValidationError as ve:
            return Response(ve.detail, status=400)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"detail": f"Error during bulk update: {str(e)}"}, status=400)

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
        if not sid:
            if is_global_admin(self.request.user):
                return Building.objects.all()
            return Building.objects.none()

        # Global admin viewing everything
        if is_global_admin(self.request.user) and not sid:
            return Building.objects.all()

        return Building.objects.filter(school_id=sid)

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
        if not sid:
            if is_global_admin(self.request.user):
                return Room.objects.all().select_related('building')
            return Room.objects.none()

        # Global admin viewing everything
        if is_global_admin(self.request.user) and not sid:
            return Room.objects.all().select_related('building')

        return Room.objects.filter(building__school_id=sid)

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
    def post(self, request): return Response({"detail": "Restored"})
