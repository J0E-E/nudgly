"""
API URL root: mounts auth and future API apps under /api/.
"""

from django.urls import include, path

urlpatterns = [
    path("auth/", include("core.auth.urls")),
]
