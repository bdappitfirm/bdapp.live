from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ClassRoomViewSet, SectionViewSet, SubjectViewSet,
    StudentProfileViewSet, TeacherAssignmentViewSet, SchoolListAPI, ImportStudentsAPI,
    VirtualClassViewSet, BuildingViewSet, RoomViewSet, ExamSeatPlanViewSet,
    UpdateStudentGendersAPI, GenerateExamSeatPlanAPI
)

router = DefaultRouter()
router.register('classrooms', ClassRoomViewSet, basename='classrooms')
router.register('sections', SectionViewSet, basename='sections')
router.register('subjects', SubjectViewSet, basename='subjects')
router.register('students', StudentProfileViewSet, basename='students')
router.register('assignments', TeacherAssignmentViewSet, basename='assignments')
router.register('virtual-classes', VirtualClassViewSet, basename='virtual-classes')
router.register('buildings', BuildingViewSet, basename='buildings')
router.register('rooms', RoomViewSet, basename='rooms')
router.register('exam-seat-plans', ExamSeatPlanViewSet, basename='exam-seat-plans')

urlpatterns = [
    path('schools/', SchoolListAPI.as_view(), name='school-list'),
    path('imports/students/', ImportStudentsAPI.as_view(), name='import-students'),
    path('update-genders/', UpdateStudentGendersAPI.as_view(), name='update-genders'),
    path('generate-seat-plan/', GenerateExamSeatPlanAPI.as_view(), name='generate-seat-plan'),
    path('', include(router.urls)),
]
