"""
Django settings for travel_route_planner project.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# 从 .env 加载（不覆盖已在 shell / 系统中设置的同名变量）
# 1) backend/.env 优先  2) 仓库根目录 .env 补全缺省项（便于把 .env 放在项目根）
load_dotenv(BASE_DIR / '.env')
load_dotenv(BASE_DIR.parent / '.env')

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-secret-key-change-in-production')

DEBUG = os.environ.get('DEBUG', 'True').lower() == 'true'

ALLOWED_HOSTS = ['localhost', '127.0.0.1']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'apps.pois',
    'apps.routes',
    'apps.trips',
    'apps.traffic',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
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

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'trace',
        'USER': 'root',
        'PASSWORD': '123456',
        'HOST': 'localhost',
        'PORT': '3307',
        'OPTIONS': {
            'charset': 'utf8mb4',
        },
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'zh-hans'
TIME_ZONE = 'Asia/Shanghai'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS settings - allow frontend origin
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]
CORS_ALLOW_CREDENTIALS = True

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
}

# OSRM API settings
OSRM_URL = os.environ.get('OSRM_URL', 'http://router.project-osrm.org')

# Baidu Maps API settings
BAIDU_MAP_AK = os.environ.get('BAIDU_MAP_AK', 'bM7KqM7xHjiLKRBFIjR1f1uybfRGdocx')
# 智能行程「确认创建」时按站点串行调用 place 检索；每次请求结束后休眠，降低 QPS/并发触发限流（秒，0 表示不延迟）
BAIDU_SMART_COMMIT_INTERVAL_SEC = float(os.environ.get('BAIDU_SMART_COMMIT_INTERVAL_SEC', '0.35'))

# External POI search cache (Baidu + Nominatim), seconds
POI_GEOSEARCH_CACHE_TTL = int(os.environ.get('POI_GEOSEARCH_CACHE_TTL', '86400'))

# Nominatim (international POI search) — public instance usage policy: ~1 req/s; set identifiable User-Agent
NOMINATIM_BASE_URL = os.environ.get('NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org').rstrip('/')
NOMINATIM_USER_AGENT = os.environ.get('NOMINATIM_USER_AGENT', '').strip()
# 可选；OSMF 政策允许用 Referer 或 User-Agent 标识应用（网站类请求可填前端或官网 URL）
NOMINATIM_REFERER = os.environ.get('NOMINATIM_REFERER', '').strip()
NOMINATIM_MIN_INTERVAL_SEC = float(os.environ.get('NOMINATIM_MIN_INTERVAL_SEC', '1.1'))
# 仅作用于 Nominatim 出站；境内直连 OSM 超时/被墙时填本机代理（如云梯常见 http://127.0.0.1:7897）
# 未设置时依次尝试标准环境变量，便于与 shell 中 export https_proxy= 一致
_nom_proxy = os.environ.get('NOMINATIM_PROXY', '').strip()
if not _nom_proxy:
    for _k in ('HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'):
        _nom_proxy = os.environ.get(_k, '').strip()
        if _nom_proxy:
            break
NOMINATIM_REQUEST_PROXIES = (
    {'http': _nom_proxy, 'https': _nom_proxy} if _nom_proxy else None
)

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'trace-poi-geosearch',
    }
}

# LLM (OpenAI-compatible chat completions) — never log LLM_API_KEY
LLM_API_BASE = os.environ.get('LLM_API_BASE', '').strip()
LLM_API_KEY = os.environ.get('LLM_API_KEY', '').strip()
LLM_MODEL = os.environ.get('LLM_MODEL', 'gpt-4o-mini').strip()
LLM_TIMEOUT = int(os.environ.get('LLM_TIMEOUT', '70'))

# Logging configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
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
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
