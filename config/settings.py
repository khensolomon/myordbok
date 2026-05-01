"""
Django settings for MyOrdbok
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables
load_dotenv(os.path.join(BASE_DIR, '.env'), interpolate=True)

# --- APPS DIRECTORY SETUP ---
# Ensures local apps in 'apps/' can be imported directly
APPS_DIR = BASE_DIR / 'apps'
sys.path.insert(0, str(APPS_DIR))

# --- CORE SECURITY ---
SECRET_KEY = os.environ.get('SECRET_KEY', 'unsafe-fallback-key-change-me')
DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")

# Split ALLOWED_HOSTS and remove empty entries
ALLOWED_HOSTS = [host.strip() for host in os.environ.get('ALLOWED_HOSTS', '*').split(',') if host.strip()]

SECURE_REFERRER_POLICY = None       # stops Referrer-Policy from Django
SECURE_CONTENT_TYPE_NOSNIFF = False # stops X-Content-Type-Options from Django  
SECURE_CROSS_ORIGIN_OPENER_POLICY = None
SECURE_BROWSER_XSS_FILTER = False

# --- APP DEFINITION ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third-party
    'rest_framework',
    'corsheaders',
    'django_vite',
    
    # Local
    'core',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    # 'django.middleware.clickjacking.XFrameOptionsMiddleware',

    # Custom middleware for HTML minification and cookie handling
    'config.middleware.HtmlMinifyMiddleware',
    'config.middleware.OrdIdCookieMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / "templates"],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',

                # Custom context processors
                "api.context_processors.app_info",

                # Context processors for navigation and cookies
                # 'app_name.filename.function_name'
                # 'core.context_processors.main_menu',
                'core.context_processors.nav_pages_builder',
                'core.context_processors.nav_terms_builder',
                "core.context_processors.cookies_read",
                
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# --- DATABASE ---
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PWD'),
        'HOST': os.environ.get('DB_HOST', 'db'),
        'PORT': os.environ.get('DB_PORT', '3306'),
        'CONN_MAX_AGE': 60,
        'OPTIONS': {
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            'charset': 'utf8mb4',
        },
    }
}

# Force collectstatic to include hidden directories like .vite/
# STATICFILES_FINDERS = [
#     'django.contrib.staticfiles.finders.FileSystemFinder',
#     'django.contrib.staticfiles.finders.AppDirectoriesFinder',
# ]

# --- STATIC & MEDIA ---
STATIC_URL = 'static/'
# STATIC_ROOT must be separate from STATICFILES_DIRS during dev
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [
   BASE_DIR / 'static',
]

MEDIA_URL = '/media/'
MEDIA_ROOT = os.environ.get('MEDIA_DIR', str(BASE_DIR / 'media'))

# --- CUSTOM DIRECTORIES ---
STORAGE_ROOT = os.environ.get('STORAGE_ROOT','/tmp/storage')
STORAGE_DIR =  os.path.join(STORAGE_ROOT,'myordbok')
CACHE_DIR = os.environ.get('CACHE_DIR')
MEDIA_DIR = MEDIA_ROOT

FONTS_DIR = os.path.join(STORAGE_ROOT, 'media', 'fonts')
SPEECH_URL = os.environ.get('SPEECH_URL')
CACHE_DIR = os.environ.get('CACHE_DIR', os.path.join('/','storage','cache'))

# --- VITE CONFIGURATION ---
DJANGO_VITE = {
  "default": {
    "dev_mode": DEBUG,
    "dev_server_port": 3021,
    "manifest_path": BASE_DIR / 'static' / ".vite" / "manifest.json",
    "static_url_prefix": "", 
  }
}

# --- LOGGING ---
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}

# --- GOOGLE CLOUD ---
BUCKETNAME = os.environ.get('BUCKETNAME')
if os.environ.get('BUCKETCRED'):
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.environ.get('BUCKETCRED')

# --- CORS & SECURITY ---
CORS_ALLOW_ALL_ORIGINS = DEBUG
if not DEBUG:
    def normalize_origin(origin):
        """Helper to ensure origins have schemes and no empty strings."""
        origin = origin.strip()
        if not origin:
            return None
        if not origin.startswith(('http://', 'https://')):
            return f'http://{origin}'
        return origin

    raw_cors = os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
    CORS_ALLOWED_ORIGINS = [o for o in map(normalize_origin, raw_cors) if o]
    
    raw_csrf = os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',')
    CSRF_TRUSTED_ORIGINS = [o for o in map(normalize_origin, raw_csrf) if o]

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'