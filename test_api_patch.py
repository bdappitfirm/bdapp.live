#!/usr/bin/env python
import os
import django
import requests
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import Profile, User
from schools.models import School
from rest_framework_simplejwt.tokens import RefreshToken

# Create superuser for testing
admin_user, _ = User.objects.get_or_create(
    username='admin_test',
    defaults={'is_staff': True, 'is_superuser': True}
)
if not admin_user.has_usable_password() or not User.objects.filter(username='admin_test', password__startswith='pbkdf2').exists():
    admin_user.set_password('admin123')
    admin_user.save()

print(f"Admin user: {admin_user.username}, is_superuser: {admin_user.is_superuser}")

# Get teacher profile
teacher = Profile.objects.filter(role='teacher').first()
if not teacher:
    school = School.objects.first()
    user = User.objects.filter(username='testteacher123').first()
    if user and school:
        teacher, _ = Profile.objects.get_or_create(user=user, defaults={'school': school, 'role': 'teacher', 'designation': 'পদবী'})
        if not teacher.designation:
            teacher.designation = 'পদবী'
            teacher.save()
    
if teacher:
    print(f"\nTeacher Profile ID: {teacher.id}")
    print(f"Teacher: {teacher.user.username}")
    print(f"Current designation: {teacher.designation}")
    
    # Generate admin token
    refresh = RefreshToken.for_user(admin_user)
    access_token = str(refresh.access_token)
    
    # Test endpoint
    url = f'http://127.0.0.1:8000/api/users/teachers/{teacher.id}/'
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    data = {'designation': 'নতুন পদবী'}
    
    print(f"\nPATCH URL: {url}")
    resp = requests.patch(url, json=data, headers=headers)
    print(f"Status: {resp.status_code}")
    
    if resp.status_code == 200:
        result = resp.json()
        print(f"✓ Designation in response: {result.get('designation')}")
        print(f"✓ Response keys: {list(result.keys())}")
    else:
        print(f"✗ Error ({resp.status_code}): {resp.text[:200]}")
else:
    print("No teacher profile found")

