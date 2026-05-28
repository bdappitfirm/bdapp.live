from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenRefreshView
from users.views import ThrottledTokenObtainPairView

def root_view(request):
    return JsonResponse({
        "message": "Welcome to School Management System API",
        "status": "Running",
        "api_v1": "/api/v1/"
    })

# API v1 Versioning
api_v1_patterns = [
    path('token/', ThrottledTokenObtainPairView.as_view()),
    path('token/refresh/', TokenRefreshView.as_view()),
    path('users/', include('users.urls')), # Move users to top for faster matching
    path('', include('schools.urls')),
    path('academics/', include('academics.urls')),
    path('attendance/', include('attendance.urls')),
    path('fees/', include('fees.urls')),
    path('results/', include('results.urls')),
]

urlpatterns = [
    path('', root_view),
    path('api/v1/', include(api_v1_patterns)),
    # Backward compatibility for existing /api/ endpoints (optional)
    path('api/', include(api_v1_patterns)),
    path('admin/', admin.site.urls),
]

# React serve (ONLY when build exists)
if not settings.DEBUG:
    urlpatterns += [
        path('', TemplateView.as_view(template_name="index.html")),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    try:
        import debug_toolbar
        urlpatterns += [
            path('__debug__/', include(debug_toolbar.urls)),
        ]
    except ImportError:
        pass
