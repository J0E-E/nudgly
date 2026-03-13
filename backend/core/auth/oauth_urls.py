"""
OAuth URL routes: complete view, authorize redirects, and allauth provider flows.
"""

from django.urls import include, path

from core.auth.oauth_views import (
    AppleAuthorizeView,
    GoogleAuthorizeView,
    oauth_complete_view,
)

urlpatterns = [
    path("complete/", oauth_complete_view, name="oauth-complete"),
    path("google/authorize/", GoogleAuthorizeView.as_view(), name="oauth-google-authorize"),
    path("apple/authorize/", AppleAuthorizeView.as_view(), name="oauth-apple-authorize"),
    path("", include("allauth.urls")),
]
