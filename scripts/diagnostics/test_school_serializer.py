#!/usr/bin/env python
"""
Debug script to test SchoolSerializer and see what's being returned
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from schools.models import School
from schools.serializers import SchoolSerializer
from django.conf import settings

# Fetch all schools
schools = School.objects.all()[:3]

print("=" * 80)
print("Testing SchoolSerializer Output")
print("=" * 80)
print(f"\nSITE_BASE_URL: {getattr(settings, 'SITE_BASE_URL', 'NOT SET')}")
print(f"DEBUG: {settings.DEBUG}")
print(f"ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")

for school in schools:
    print(f"\n🏫 School ID: {school.id} - {school.name}")
    print("-" * 80)
    
    # Check raw model fields
    print(f"  Raw Model Fields:")
    print(f"    logo: {school.logo} (empty: {not school.logo})")
    print(f"    logo.url: {school.logo.url if school.logo else 'N/A'}")
    print(f"    principal_signature: {school.principal_signature} (empty: {not school.principal_signature})")
    print(f"    school_seal: {school.school_seal} (empty: {not school.school_seal})")
    
    # Serialize WITHOUT request context (to avoid HOST error)
    serializer = SchoolSerializer(school, context={})
    data = serializer.data
    
    print(f"\n  Serialized Output (without request context):")
    print(f"    logo: {data.get('logo')}")
    print(f"    principal_signature: {data.get('principal_signature')}")
    print(f"    school_seal: {data.get('school_seal')}")
    
    # Check if URLs are absolute
    for field in ['logo', 'principal_signature', 'school_seal']:
        val = data.get(field)
        if val:
            is_absolute = val.startswith('http')
            is_relative = val.startswith('/media')
            print(f"    {field} - absolute URL: {is_absolute}, relative: {is_relative}")

print("\n" + "=" * 80)
print("✅ Test Complete")
print("=" * 80)
