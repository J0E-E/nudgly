# Django project package — ensure Celery app is loaded on startup.
from .celery import app as celery_app

__all__ = ("celery_app",)
