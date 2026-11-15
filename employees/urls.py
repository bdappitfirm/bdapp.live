from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DepartmentViewSet, DesignationViewSet, EmployeeViewSet

router = DefaultRouter()
router.register(r'departments', DepartmentViewSet, basename='employee-department')
router.register(r'designations', DesignationViewSet, basename='employee-designation')
router.register(r'employees', EmployeeViewSet, basename='employee')

urlpatterns = [
    path('', include(router.urls)),
]
