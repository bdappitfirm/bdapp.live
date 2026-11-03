import os
import sys
import django

sys.path.insert(0, 'F:/bdedu')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.apps import apps
from academics.models import Subject

print("=== ALL FOREIGN KEYS TO SUBJECT ===")
for model in apps.get_models():
    for field in model._meta.get_fields():
        if field.is_relation and field.related_model == Subject:
            print(f"Model: {model.__module__}.{model.__name__} | Field: {field.name} | Type: {type(field).__name__}")
