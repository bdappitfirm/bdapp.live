
import os
import sys

# Add the project root to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

print("Testing Django WSGI import...")
try:
    from django.core.wsgi import get_wsgi_application
    application = get_wsgi_application()
    print("✅ WSGI application imported successfully!")

    # Test if we can access settings
    from django.conf import settings
    print(f"✅ Settings loaded! DEBUG={settings.DEBUG}")
    print(f"✅ INSTALLED_APPS={[app.split('.')[-1] for app in settings.INSTALLED_APPS[:5]]}...")

    print("🎉 WSGI test passed!")
except Exception as e:
    print(f"❌ ERROR importing WSGI: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
