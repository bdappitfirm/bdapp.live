from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ExaminationViewSet, ResultViewSet, StudentOverallResultViewSet, ExamSlotViewSet

router = DefaultRouter()
router.register('examinations', ExaminationViewSet, basename='examinations')
router.register('results', ResultViewSet, basename='results')
router.register('overall', StudentOverallResultViewSet, basename='overall')
router.register('exam-slots', ExamSlotViewSet, basename='exam-slots')

urlpatterns = [
    path('', include(router.urls)),
]
