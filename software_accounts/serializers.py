from rest_framework import serializers
from .models import SoftwareIncome, FirmExpense
from schools.models import School

class SoftwareIncomeSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True)

    class Meta:
        model = SoftwareIncome
        fields = '__all__'

class FirmExpenseSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = FirmExpense
        fields = '__all__'
