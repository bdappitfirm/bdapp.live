from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AttendanceRecordViewSet
from .summary_views import AttendanceSummaryViewSet

router = DefaultRouter()
router.register('records', AttendanceRecordViewSet)
router.register('summaries', AttendanceSummaryViewSet)

urlpatterns = [path('', include(router.urls))]
