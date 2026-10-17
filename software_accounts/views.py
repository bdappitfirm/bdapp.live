from rest_framework import viewsets, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from .models import SoftwareIncome, FirmExpense
from .serializers import SoftwareIncomeSerializer, FirmExpenseSerializer
from schools.models import School, SchoolBilling

class SoftwareIncomeViewSet(viewsets.ModelViewSet):
    queryset = SoftwareIncome.objects.select_related('school').all()
    serializer_class = SoftwareIncomeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        school_id = self.request.query_params.get('school_id') or self.request.query_params.get('school')
        if school_id:
            qs = qs.filter(school_id=school_id)
        return qs

class FirmExpenseViewSet(viewsets.ModelViewSet):
    queryset = FirmExpense.objects.all()
    serializer_class = FirmExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs

class SoftwareAccountsSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            # 1. Total Software Income from manual records + SchoolBilling total_paid
            manual_income_total = SoftwareIncome.objects.aggregate(total=Sum('amount'))['total'] or 0
            billing_income_total = SchoolBilling.objects.aggregate(total=Sum('total_paid'))['total'] or 0
            total_income = float(manual_income_total) + float(billing_income_total)

            # 2. Total Expenses
            total_expense = FirmExpense.objects.aggregate(total=Sum('amount'))['total'] or 0
            total_expense = float(total_expense)

            # 3. Net Balance / Surplus (उद्धৃত্ত / উদ্ধুতি / জের)
            net_balance = total_income - total_expense

            # 4. Expense Breakdown by Category
            expense_by_cat = list(
                FirmExpense.objects.values('category')
                .annotate(total=Sum('amount'), count=Count('id'))
                .order_by('-total')
            )
            # Add category display name
            cat_display_map = dict(FirmExpense.EXPENSE_CATEGORIES)
            for item in expense_by_cat:
                item['category_display'] = cat_display_map.get(item['category'], item['category'])
                item['total'] = float(item['total'] or 0)

            # 5. Income Breakdown by Type / School
            income_by_type = list(
                SoftwareIncome.objects.values('income_type')
                .annotate(total=Sum('amount'), count=Count('id'))
                .order_by('-total')
            )
            for item in income_by_type:
                item['total'] = float(item['total'] or 0)

            # 6. School-wise billing & income status
            schools = School.objects.annotate(
                student_count_annotated=Count('students', distinct=True)
            ).select_related('billing').order_by('name')

            school_list = []
            for s in schools:
                paid = float(s.billing.total_paid) if hasattr(s, 'billing') and s.billing else 0.0
                manual_sch_income = SoftwareIncome.objects.filter(school=s).aggregate(total=Sum('amount'))['total'] or 0.0
                total_sch_paid = paid + float(manual_sch_income)
                school_list.append({
                    'id': s.id,
                    'name': s.name,
                    'ein': s.ein,
                    'student_count': s.student_count_annotated,
                    'total_paid': total_sch_paid,
                    'link': f"https://bdapp.live/school/{s.id}"
                })

            return Response({
                'total_income': total_income,
                'manual_income_total': float(manual_income_total),
                'billing_income_total': float(billing_income_total),
                'total_expense': total_expense,
                'net_balance': net_balance,
                'expense_by_category': expense_by_cat,
                'income_by_type': income_by_type,
                'schools_summary': school_list
            })
        except Exception as e:
            return Response({'error': str(e)}, status=400)
