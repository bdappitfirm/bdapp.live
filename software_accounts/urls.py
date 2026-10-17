from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SoftwareIncomeViewSet, FirmExpenseViewSet, SoftwareAccountsSummaryView

router = DefaultRouter()
router.register(r'incomes', SoftwareIncomeViewSet, basename='software-income')
router.register(r'expenses', FirmExpenseViewSet, basename='firm-expense')

urlpatterns = [
    path('summary/', SoftwareAccountsSummaryView.as_view(), name='software-accounts-summary'),
    path('', include(router.urls)),
]
