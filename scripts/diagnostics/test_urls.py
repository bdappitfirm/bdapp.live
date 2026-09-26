import os
import django
from django.conf import settings

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.urls import resolve, reverse
from users.views import SupportCallMyActiveView

def test_urls():
    url = '/api/users/support/calls/active/'
    try:
        match = resolve(url)
        print(f"URL '{url}' matches view: {match.func}")
        print(f"View class: {match.func.view_class}")
    except Exception as e:
        print(f"URL '{url}' failed to resolve: {e}")

    try:
        rev = reverse('support-call-active')
        print(f"Reverse for 'support-call-active': {rev}")
    except Exception as e:
        print(f"Reverse for 'support-call-active' failed: {e}")

if __name__ == "__main__":
    test_urls()
