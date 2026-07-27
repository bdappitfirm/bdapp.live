from django.urls import path, include
from .views import (
    SchoolViewSet, dashboard_stats, AdvertisementViewSet,
    AdvertisementBySchool, AdvertisementBulk, BulkSchoolSetup, BanbeisDetailView
)
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'schools', SchoolViewSet)
router.register(r'ads', AdvertisementViewSet, basename='ads')

urlpatterns = [
    path('dashboard-stats/', dashboard_stats, name='dashboard-stats'),
    path('setup-bulk/', BulkSchoolSetup.as_view(), name='school-setup-bulk'),
    path('banbeis/<int:school_id>/', BanbeisDetailView.as_view(), name='banbeis-detail'),
    path('banbeis/<int:school_id>/fetch_external/', BanbeisDetailView.as_view(), name='banbeis-fetch-external'),
    path('', include(router.urls)),
    # Ads convenience endpoints
    path('schools/<int:school_id>/ads/', AdvertisementBySchool.as_view(), name='school-ads'),
    path('ads/bulk/', AdvertisementBulk.as_view(), name='ads-bulk'),
]
