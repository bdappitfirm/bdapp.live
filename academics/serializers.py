from rest_framework import serializers
from schools.models import School
from .models import ClassRoom, Section, Subject, StudentProfile, TeacherAssignment, VirtualClass, Building, Room, ExamSeatPlan
from django.contrib.auth import get_user_model
from users.models import Profile
import re
import unicodedata

User = get_user_model()

class SchoolSerializer(serializers.ModelSerializer):
    logo_thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = School
        fields = ['id', 'name', 'address', 'logo', 'logo_thumbnail_url', 'principal_signature', 'school_seal']

    def get_logo_thumbnail_url(self, obj):
        try:
            if hasattr(obj, 'logo_thumbnail') and obj.logo_thumbnail:
                return obj.logo_thumbnail.url
            if hasattr(obj, 'logo') and obj.logo:
                return obj.logo.url
        except Exception:
            pass
        return None

class SimpleUserSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    mobile_number = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'phone_number', 'photo', 'thumbnail', 'photo_url', 'thumbnail_url', 'mobile_number', 'educational_qualification']
    
    def get_photo_url(self, obj):
        try:
            if obj.photo:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(obj.photo.url)
                return obj.photo.url
        except Exception:
            pass
        return None

    def get_thumbnail_url(self, obj):
        try:
            url = None
            if hasattr(obj, 'thumbnail') and obj.thumbnail:
                url = obj.thumbnail.url
            elif hasattr(obj, 'photo') and obj.photo:
                url = obj.photo.url

            if url:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(url)
                return url
        except Exception:
            pass
        return None
    
    def get_mobile_number(self, obj):
        return getattr(obj, 'phone_number', None)

class ClassRoomSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)
    school_id = serializers.PrimaryKeyRelatedField(source='school', queryset=School.objects.all(), write_only=True)
    student_count = serializers.SerializerMethodField()
    sections = serializers.SerializerMethodField()
    
    def get_student_count(self, obj):
        return getattr(obj, 'annotated_student_count', obj.students.count())
    
    def get_sections(self, obj):
        return [{'id': s.id, 'name': s.name} for s in obj.sections.all()]
        
    class Meta:
        model = ClassRoom
        fields = ['id', 'school', 'school_id', 'name', 'description', 'student_count', 'sections']

class SectionSerializer(serializers.ModelSerializer):
    classroom = ClassRoomSerializer(read_only=True)
    classroom_id = serializers.PrimaryKeyRelatedField(source='classroom', queryset=ClassRoom.objects.all(), write_only=True)
    student_count = serializers.SerializerMethodField()

    def get_student_count(self, obj):
        return obj.students.filter(classroom=obj.classroom).count()

    class Meta:
        model = Section
        fields = ['id', 'classroom', 'classroom_id', 'name', 'student_count']

class SubjectSerializer(serializers.ModelSerializer):
    assigned_teachers = serializers.SerializerMethodField()
    school_id = serializers.PrimaryKeyRelatedField(source='school', queryset=School.objects.all(), write_only=True, required=False)
    classrooms = serializers.PrimaryKeyRelatedField(many=True, queryset=ClassRoom.objects.all(), required=False)
    sections = serializers.PrimaryKeyRelatedField(many=True, queryset=Section.objects.all(), required=False)
    
    class Meta:
        model = Subject
        fields = ['id', 'school', 'school_id', 'name', 'code', 'assigned_teachers', 'classrooms', 'sections']
        read_only_fields = ['school']

    def get_assigned_teachers(self, obj):
        try:
            if not obj.id: return []
            classroom_id = self.context.get('classroom_id') if self.context else None
            section_id = self.context.get('section_id') if self.context else None

            assignments = obj.assignments.all()
            if classroom_id:
                from django.db.models import Q
                filter_q = Q(classroom_id=classroom_id)
                if section_id:
                    filter_q &= (Q(section_id=section_id) | Q(section__isnull=True))
                assignments = assignments.filter(filter_q)

            teachers_data = []
            seen_teachers = set()
            for assignment in assignments:
                teacher = assignment.teacher
                if not teacher or teacher.id in seen_teachers: continue
                seen_teachers.add(teacher.id)
                teachers_data.append({
                    'id': teacher.id,
                    'assignment_id': assignment.id,
                    'username': teacher.username,
                    'first_name': teacher.first_name,
                    'last_name': teacher.last_name,
                    'email': teacher.email,
                    'phone_number': getattr(teacher, 'phone_number', ''),
                })
            return teachers_data
        except Exception:
            return []

class TinyClassRoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassRoom
        fields = ['id', 'name']

class TinySectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ['id', 'name']

class StudentProfileSerializer(serializers.ModelSerializer):
    user = SimpleUserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(source='user', queryset=User.objects.all(), write_only=True, required=False, allow_null=True)
    school = serializers.IntegerField(source='school_id', read_only=True)
    school_id = serializers.PrimaryKeyRelatedField(source='school', queryset=School.objects.all(), write_only=True, required=False)
    classroom = TinyClassRoomSerializer(read_only=True)
    classroom_id = serializers.PrimaryKeyRelatedField(source='classroom', queryset=ClassRoom.objects.all(), write_only=True, allow_null=True, required=False)
    section = TinySectionSerializer(read_only=True)
    section_id = serializers.PrimaryKeyRelatedField(source='section', queryset=Section.objects.all(), write_only=True, allow_null=True, required=False)
    guardian = SimpleUserSerializer(read_only=True)
    guardian_id = serializers.PrimaryKeyRelatedField(source='guardian', queryset=User.objects.all(), write_only=True, allow_null=True, required=False)
    father = SimpleUserSerializer(read_only=True)
    father_id = serializers.PrimaryKeyRelatedField(source='father', queryset=User.objects.all(), write_only=True, allow_null=True, required=False)
    mother = SimpleUserSerializer(read_only=True)
    mother_id = serializers.PrimaryKeyRelatedField(source='mother', queryset=User.objects.all(), write_only=True, allow_null=True, required=False)
    username = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False)
    first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    phone_number = serializers.CharField(write_only=True, required=False, allow_blank=True)
    optional_subject_id = serializers.PrimaryKeyRelatedField(source='optional_subject', queryset=Subject.objects.all(), write_only=True, allow_null=True, required=False)
    guardian_name = serializers.CharField(required=False, allow_blank=True)
    photo = serializers.ImageField(write_only=True, required=False)
    student_custom_id = serializers.CharField(read_only=True)
    group = serializers.CharField(source='student_group', required=False, allow_null=True, allow_blank=True)

    _birth_date_db_exists = None
    @classmethod
    def birth_date_db_exists(cls):
        if cls._birth_date_db_exists is None:
            try:
                from django.db import connection
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1 FROM information_schema.columns WHERE table_name = 'academics_studentprofile' AND column_name = 'birth_date'")
                    cls._birth_date_db_exists = cursor.fetchone() is not None
            except Exception: cls._birth_date_db_exists = False
        return cls._birth_date_db_exists

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not self.birth_date_db_exists(): self.fields.pop('birth_date', None)

    class Meta:
        model = StudentProfile
        fields = ['id', 'user', 'user_id', 'username', 'password', 'first_name', 'last_name', 'email', 'phone_number', 'photo', 'school', 'school_id', 'classroom', 'classroom_id', 'section', 'section_id', 'roll_number', 'group', 'student_group', 'blood_group', 'gender', 'birth_date', 'student_custom_id', 'optional_subject', 'optional_subject_id', 'guardian', 'guardian_id', 'guardian_name', 'father', 'father_id', 'father_name', 'mother', 'mother_id', 'mother_name', 'admission_date', 'address', 'remarks', 'voter_number', 'subjects_list']
        read_only_fields = ['school']

    def create(self, validated_data):
        if not self.birth_date_db_exists(): validated_data.pop('birth_date', None)
        school = validated_data.pop('school', None)
        if not school:
            sid = self.initial_data.get('school') or self.initial_data.get('school_id')
            if sid: school = School.objects.filter(pk=sid).first()
        if not school: raise serializers.ValidationError({'school': 'This field is required.'})
        user_data = {k: validated_data.pop(k, '') for k in ['username', 'password', 'first_name', 'last_name', 'email', 'phone_number', 'photo']}
        if not user_data['username']:
            base = re.sub(r'[^a-z]', '', user_data['first_name'].lower()) or 'student'
            user_data['username'] = f"{base}{User.objects.count() + 1}"
        user = User.objects.create_user(username=user_data['username'], password=user_data['password'] or '12345678', first_name=user_data['first_name'], last_name=user_data['last_name'], email=user_data['email'])
        Profile.objects.update_or_create(user=user, defaults={'school': school, 'role': 'student', 'gender': validated_data.get('gender')})
        return StudentProfile.objects.create(user=user, school=school, **validated_data)

    def update(self, instance, validated_data):
        if not self.birth_date_db_exists(): validated_data.pop('birth_date', None)

        # Separate User model fields from StudentProfile fields
        user_fields = ['username', 'password', 'first_name', 'last_name', 'email', 'phone_number', 'photo']
        user_data = {f: validated_data.pop(f) for f in user_fields if f in validated_data}

        # Update User model if needed
        if user_data:
            user = instance.user
            user_updated = False

            if 'username' in user_data:
                norm_username = unicodedata.normalize('NFKC', str(user_data['username'])).strip()
                if User.objects.filter(username=norm_username).exclude(pk=user.pk).exists():
                     raise serializers.ValidationError({'username': 'This username is already taken.'})
                user.username = norm_username
                user_updated = True

            if 'password' in user_data and user_data['password']:
                user.set_password(user_data['password'])
                user_updated = True

            if 'first_name' in user_data:
                user.first_name = user_data['first_name']
                user_updated = True

            if 'last_name' in user_data:
                user.last_name = user_data['last_name']
                user_updated = True

            if 'email' in user_data:
                user.email = user_data['email']
                user_updated = True

            if 'phone_number' in user_data:
                user.phone_number = user_data['phone_number']
                user_updated = True

            if 'photo' in user_data:
                user.photo = user_data['photo']
                user_updated = True

            if user_updated:
                user.save()

            # Update Profile gender if it was updated in StudentProfile
            if 'gender' in validated_data:
                Profile.objects.filter(user=user).update(gender=validated_data['gender'])

        # Continue with StudentProfile update
        return super().update(instance, validated_data)

class TeacherAssignmentSerializer(serializers.ModelSerializer):
    teacher = SimpleUserSerializer(read_only=True)
    teacher_id = serializers.PrimaryKeyRelatedField(source='teacher', queryset=User.objects.all(), write_only=True)
    classroom = ClassRoomSerializer(read_only=True)
    classroom_id = serializers.PrimaryKeyRelatedField(source='classroom', queryset=ClassRoom.objects.all(), write_only=True)
    section = SectionSerializer(read_only=True)
    section_id = serializers.PrimaryKeyRelatedField(source='section', queryset=Section.objects.all(), write_only=True, allow_null=True, required=False)
    subject = SubjectSerializer(read_only=True)
    subject_id = serializers.PrimaryKeyRelatedField(source='subject', queryset=Subject.objects.all(), write_only=True, allow_null=True)
    class Meta:
        model = TeacherAssignment
        fields = ['id', 'teacher', 'teacher_id', 'subject', 'subject_id', 'classroom', 'classroom_id', 'section', 'section_id']

class VirtualClassSerializer(serializers.ModelSerializer):
    teacher_name = serializers.SerializerMethodField()
    subject_name = serializers.ReadOnlyField(source='subject.name')
    classroom_name = serializers.ReadOnlyField(source='classroom.name')
    section_name = serializers.ReadOnlyField(source='section.name')
    class Meta:
        model = VirtualClass
        fields = ['id', 'school', 'teacher', 'teacher_name', 'classroom', 'classroom_name', 'section', 'section_name', 'subject', 'subject_name', 'meeting_id', 'is_active', 'started_at', 'ended_at']
        read_only_fields = ['teacher', 'started_at', 'ended_at', 'meeting_id']
    def get_teacher_name(self, obj): return obj.teacher.get_full_name() if obj.teacher else "Unknown"

class BuildingSerializer(serializers.ModelSerializer):
    school_id = serializers.PrimaryKeyRelatedField(source='school', queryset=School.objects.all(), write_only=True)
    school = SchoolSerializer(read_only=True)
    class Meta:
        model = Building
        fields = ['id', 'school', 'school_id', 'name', 'description']

class RoomSerializer(serializers.ModelSerializer):
    building_id = serializers.PrimaryKeyRelatedField(source='building', queryset=Building.objects.all(), write_only=True)
    building = BuildingSerializer(read_only=True)
    class Meta:
        model = Room
        fields = ['id', 'building', 'building_id', 'name', 'capacity']

class ExamSeatPlanSerializer(serializers.ModelSerializer):
    student = StudentProfileSerializer(read_only=True)
    room = RoomSerializer(read_only=True)
    class Meta:
        model = ExamSeatPlan
        fields = ['id', 'examination', 'student', 'room', 'seat_number', 'gender_segregated', 'session']
