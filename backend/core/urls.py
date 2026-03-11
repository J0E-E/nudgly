"""
Health endpoint URL.
GET /health/ returns JSON with status, database, and redis (200 when all ok, 503 when any down).
"""

from django.urls import path

from core.views import health_view

urlpatterns = [
    path("", health_view),
]
