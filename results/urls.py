from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ExaminationViewSet, ResultViewSet, StudentOverallResultViewSet, ExamSlotViewSet

router = DefaultRouter()
router.register('examinations', ExaminationViewSet)
router.register('results', ResultViewSet)
router.register('overall', StudentOverallResultViewSet)
router.register('exam-slots', ExamSlotViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
