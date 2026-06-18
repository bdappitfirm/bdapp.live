from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ClassRoomViewSet, SectionViewSet, SubjectViewSet,
    StudentProfileViewSet, TeacherAssignmentViewSet, SchoolListAPI, ImportStudentsAPI,
    VirtualClassViewSet, BuildingViewSet, RoomViewSet, ExamSeatPlanViewSet,
    UpdateStudentGendersAPI, GenerateExamSeatPlanAPI
)

router = DefaultRouter()
router.register('classrooms', ClassRoomViewSet)
router.register('sections', SectionViewSet)
router.register('subjects', SubjectViewSet)
router.register('students', StudentProfileViewSet)
router.register('assignments', TeacherAssignmentViewSet)
router.register('virtual-classes', VirtualClassViewSet)
router.register('buildings', BuildingViewSet)
router.register('rooms', RoomViewSet)
router.register('exam-seat-plans', ExamSeatPlanViewSet)

urlpatterns = [
    path('schools/', SchoolListAPI.as_view(), name='school-list'),
    path('imports/students/', ImportStudentsAPI.as_view(), name='import-students'),
    path('update-genders/', UpdateStudentGendersAPI.as_view(), name='update-genders'),
    path('generate-seat-plan/', GenerateExamSeatPlanAPI.as_view(), name='generate-seat-plan'),
    path('', include(router.urls)),
]
