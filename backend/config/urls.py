"""
Root URL configuration.
Health and future API routes live under config and app urlconfs.
"""

from django.urls import include, path

urlpatterns = [
    path("health/", include("core.urls")),
    path("api/", include("core.api_urls")),
]
