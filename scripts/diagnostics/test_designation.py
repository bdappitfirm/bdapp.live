#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.models import Profile, User
from schools.models import School
from users.serializers import TeacherProfileSerializer
import json

# Get or create school
school = School.objects.first()
if not school:
    school = School.objects.create(name="Test School", address="Test")
    print("Created school:", school.name)

# Create user
user, _ = User.objects.get_or_create(
    username='testteacher123',
    defaults={'first_name': 'টেস্ট', 'last_name': 'শিক্ষক'}
)
print("Using user:", user.username)

# Create or update teacher profile
profile, created = Profile.objects.get_or_create(
    user=user,
    defaults={'school': school, 'role': 'teacher', 'designation': 'প্রধান শিক্ষক'}
)
if not created:
    profile.designation = 'প্রধান শিক্ষক'
    profile.save()
print("Profile designation:", profile.designation)

# Test serializer
serializer = TeacherProfileSerializer(profile)
data = serializer.data

print("\n=== SERIALIZER RESPONSE ===")
print("Keys:", list(data.keys()))
print("\nDesignation field value:", repr(data.get('designation')))
print("\n=== FULL RESPONSE ===")
print(json.dumps(data, indent=2, default=str))
