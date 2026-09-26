from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file
load_dotenv(os.path.join(BASE_DIR, '.env'))

try:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    SENTRY_AVAILABLE = True
except ImportError:
    SENTRY_AVAILABLE = False
from datetime import timedelta
from django.core.management.utils import get_random_secret_key

# Sentry initialization
SENTRY_DSN = os.environ.get("SENTRY_DSN")
if SENTRY_AVAILABLE and SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=1.0,
        send_default_pii=True
    )

# ============================
# SECURITY & ENV VARIABLES
# ============================

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-only-for-local")

DEBUG = os.environ.get("DEBUG", "True").lower() in ["true", "1"]

def _env_flag(key):
    v = os.environ.get(key)
    return v is not None and str(v).lower() in ["true", "1", "yes", "y"]

PG_NAME = os.environ.get("PG_NAME", "local_pg_db")
PG_USER = os.environ.get("PG_USER", "local_pg_user")
PG_PASSWORD = os.environ.get("PG_PASSWORD", "")
PG_HOST = os.environ.get("PG_HOST", "localhost")
PG_PORT = os.environ.get("PG_PORT", "5432")
SQLITE_PATH = BASE_DIR / "db.sqlite3"
# Default to Postgres; allow explicit override to SQLite via USE_POSTGRES=0
USE_POSTGRES = _env_flag("USE_POSTGRES") if os.environ.get("USE_POSTGRES") is not None else True

ALLOWED_HOSTS = ['127.0.0.1', 'localhost', '138.252.124.52', '103.112.62.72', 'bdapp.live', 'www.bdapp.live', 'api.bdapp.live']

# CSRF Trusted Origins for production
CSRF_TRUSTED_ORIGINS = [
    "https://bdapp.live",
    "https://www.bdapp.live",
    "http://138.252.124.52",
    "http://103.112.62.72",
]

# ============================
# INSTALLED APPS
# ============================

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',

    # Your Apps
    'schools',
    'academics',
    'attendance',
    'fees',
    'users.apps.UsersConfig',
    'results.apps.ResultsConfig',
]

try:
    import debug_toolbar
    DEBUG_TOOLBAR_AVAILABLE = True
except ImportError:
    DEBUG_TOOLBAR_AVAILABLE = False

if DEBUG and DEBUG_TOOLBAR_AVAILABLE:
    INSTALLED_APPS += ['debug_toolbar']

# ============================
# MIDDLEWARE
# ============================

MIDDLEWARE = [
    'backend.middleware.GlobalExceptionHandlerMiddleware', # Added global exception handler at top
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'schools.middleware.TenantMiddleware',
]

if DEBUG and DEBUG_TOOLBAR_AVAILABLE:
    MIDDLEWARE.insert(0, 'debug_toolbar.middleware.DebugToolbarMiddleware')
    INTERNAL_IPS = ['127.0.0.1']

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'

# ============================
# DATABASE CONFIGURATION
# ============================

if USE_POSTGRES:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': PG_NAME,
            'USER': PG_USER,
            'PASSWORD': PG_PASSWORD,
            'HOST': PG_HOST,
            'PORT': PG_PORT,
            'CONN_MAX_AGE': 60,  # Keep connections alive for 60 seconds (connection pooling)
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': SQLITE_PATH,
        }
    }

# ============================
# AUTHENTICATION
# ============================

AUTH_USER_MODEL = 'users.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ============================
# INTERNATIONALIZATION
# ============================

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Dhaka'
USE_I18N = True
USE_TZ = True

# ============================
# STATIC & MEDIA FILES
# ============================

STATIC_URL = '/backend-static/'
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'frontend', 'build', 'static'),
    os.path.join(BASE_DIR, 'static'),
]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ============================
# CACHING (Redis)
# ============================
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        },
        'KEY_PREFIX': 'bdapp'
    }
}

# ============================
# REST FRAMEWORK & JWT
# ============================

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': None,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'JTI_CLAIM': 'jti',
}

# CORS Configuration
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://bdapp.live",
    "https://www.bdapp.live",
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://localhost:\d+$",
    r"^http://127\.0\.0\.1:\d+$",
]
CORS_ALLOW_ALL_ORIGINS = False

# Production security settings
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    USE_X_FORWARDED_HOST = True
    USE_X_FORWARDED_PORT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# ============================
# EMAIL SETTINGS
# ============================

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')

# ============================
# AI & EXTERNAL SERVICES
# ============================

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

SMS_PROVIDER = os.environ.get('SMS_PROVIDER', 'console')
SMS_API_KEY = os.environ.get('SMS_API_KEY', '')
SMS_API_SECRET = os.environ.get('SMS_API_SECRET', '')
SMS_SENDER_ID = os.environ.get('SMS_SENDER_ID', 'School')
SMS_CUSTOM_API_URL = os.environ.get('SMS_CUSTOM_API_URL', '')
