#!/usr/bin/env python
"""
Check what the API actually returns for schools endpoint
"""
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from schools.serializers import SchoolSerializer
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

# Create a real DRF request
factory = APIRequestFactory()
django_request = factory.get('/api/schools/')
drf_request = Request(django_request)

# Test with request context (what the API returns)
schools = School.objects.all()[:3]

print("=" * 80)
print("API Response Test (with Request context)")
print("=" * 80)

for school in schools:
    serializer = SchoolSerializer(school, context={'request': drf_request})
    data = serializer.data
    
    print(f"\n🏫 School: {school.name}")
    print(f"  logo: {data.get('logo')}")
    print(f"  principal_signature: {data.get('principal_signature')}")
    print(f"  school_seal: {data.get('school_seal')}")

print("\n" + "=" * 80)
