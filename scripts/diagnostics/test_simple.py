print("Hello world test 123")
import sys
print("Python:", sys.version)
import os
print("CWD:", os.getcwd())
try:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    import django
    django.setup()
    print("Django setup OK")
except Exception as e:
    print(f"Django setup FAILED: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
