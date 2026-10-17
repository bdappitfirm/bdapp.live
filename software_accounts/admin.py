from django.contrib import admin
from .models import SoftwareIncome, FirmExpense

@admin.register(SoftwareIncome)
class SoftwareIncomeAdmin(admin.ModelAdmin):
    list_display = ('school', 'title', 'amount', 'income_date', 'payment_method', 'income_type')
    list_filter = ('income_type', 'payment_method', 'income_date')
    search_fields = ('title', 'school__name', 'notes')

@admin.register(FirmExpense)
class FirmExpenseAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'amount', 'expense_date', 'paid_to')
    list_filter = ('category', 'expense_date')
    search_fields = ('title', 'paid_to', 'notes')
