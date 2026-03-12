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
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "config",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
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

# Frontend origin for password-reset links (e.g. http://localhost:5173 or https://app.example.com).
FRONTEND_ORIGIN = env("FRONTEND_ORIGIN")

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
