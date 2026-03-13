"""
Django settings for Nudgly API.
Uses django-environ for env-based config; see .env.example for required variables.
"""

import sys
from datetime import timedelta
from pathlib import Path

import environ

# Build paths relative to backend/
BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOWED_ORIGINS=(list, []),
    CORS_ALLOW_ALL_ORIGINS=(bool, False),
    EMAIL_SENDER=(str, "stdout"),
    FRONTEND_ORIGIN=(str, "http://localhost:5173"),
    GOOGLE_CLIENT_ID=(str, ""),
    GOOGLE_CLIENT_SECRET=(str, ""),
    APPLE_CLIENT_ID=(str, ""),
    APPLE_CLIENT_SECRET=(str, ""),
)

# Read .env from repo root (parent of backend/) so Docker and local dev share one file
env_file = BASE_DIR.parent / ".env"
if env_file.exists():
    environ.Env.read_env(str(env_file))

SECRET_KEY = env("SECRET_KEY", default="django-insecure-dev-only-change-in-production")

DEBUG = env("DEBUG")

ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# Custom user model; must be set before first migration that references User.
AUTH_USER_MODEL = "core.User"

# Application definition
INSTALLED_APPS = [
    "django.contrib.sites",
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.apple",
    "config",
    "core",
]

# Allauth requires Sites framework; use default site (id=1).
SITE_ID = 1

# Allauth: use email from provider; no username on signup (we set it in adapter).
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_EMAIL_VERIFICATION = "optional"
ACCOUNT_AUTHENTICATION_METHOD = "email"
# Adapter customizes user creation (random username) and login redirect (JWT).
ACCOUNT_ADAPTER = "core.auth.adapters.NudglyAccountAdapter"
SOCIALACCOUNT_ADAPTER = "core.auth.adapters.NudglySocialAccountAdapter"
# Redirect to provider on GET so /oauth/<provider>/login/ skips socialaccount/login.html (SPA starts flow via link).
SOCIALACCOUNT_LOGIN_ON_GET = True

# OAuth provider credentials from env (see .env.example).
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
        "APP": {
            "client_id": env("GOOGLE_CLIENT_ID"),
            "secret": env("GOOGLE_CLIENT_SECRET"),
        },
    },
    "apple": {
        "APP": {
            "client_id": env("APPLE_CLIENT_ID"),
            "secret": env("APPLE_CLIENT_SECRET"),
        },
    },
}

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "config.urls"

WSGI_APPLICATION = "config.wsgi.application"

# CORS: allow origins from env; dev can use CORS_ALLOW_ALL_ORIGINS=True for permissive local dev
CORS_ALLOW_ALL_ORIGINS = env("CORS_ALLOW_ALL_ORIGINS")
if not CORS_ALLOW_ALL_ORIGINS:
    CORS_ALLOWED_ORIGINS = env(
        "CORS_ALLOWED_ORIGINS"
    )  # empty list = no cross-origin allowed

# Database (PostgreSQL; use SQLite in-memory for tests so no Postgres required)
if "test" in sys.argv:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": ":memory:",
        }
    }
else:
    DATABASES = {
        "default": env.db(
            "DATABASE_URL",
            default="postgres://nudgly:nudgly@localhost:5432/nudgly",
        )
    }

# Redis (for health check and future Celery)
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")

# Email: adapter name for get_email_sender(); "stdout" logs to logger (dev/test). Add sendgrid etc. later.
EMAIL_SENDER = env("EMAIL_SENDER")

# Frontend origin for password-reset links and OAuth callback redirect.
FRONTEND_ORIGIN = env("FRONTEND_ORIGIN")

# Allauth: after social login, redirect to our view that issues JWT and sends user to frontend.
LOGIN_REDIRECT_URL = "/api/auth/oauth/complete/"

# Rest framework: JWT auth for API; health remains unauthenticated.
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
}

# Simple JWT: access/refresh lifetimes; blacklist for logout.
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": True,
}

# Security
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"
