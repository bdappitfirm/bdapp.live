#!/usr/bin/env python
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import Profile
from users.serializers import TeacherProfileSerializer
import json

# Get teacher
teacher = Profile.objects.filter(role='teacher').first()

if teacher:
    print("BEFORE UPDATE:")
    print(f"designation in DB: {teacher.designation}")
    
    # Simulate what PATCH would do
    update_data = {'designation': 'নেতৃত্ব শিক্ষক (আপডেট করা)'}
    
    serializer = TeacherProfileSerializer(teacher, data=update_data, partial=True)
    
    if serializer.is_valid():
        updated_profile = serializer.save()
        response_data = TeacherProfileSerializer(updated_profile).data
        
        print("\nAFTER UPDATE:")
        print(f"designation in DB: {updated_profile.designation}")
        
        print("\n✓ Response data from serializer:")
        print(f"  'designation' in response: {'designation' in response_data}")
        print(f"  designation value: {response_data.get('designation')}")
        
        # This is what gets sent to frontend
        print(f"\nJSON that frontend receives:")
        print(json.dumps({
            'designation': response_data.get('designation'),
            'id': response_data.get('id'),
            'user': response_data.get('user'),
        }, indent=2, default=str, ensure_ascii=False))
    else:
        print(f"Serializer errors: {serializer.errors}")
else:
    print("No teacher found")
