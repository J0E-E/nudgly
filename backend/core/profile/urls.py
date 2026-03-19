"""
Profile URL routes under /api/users/.
"""

from django.urls import path

from core.profile.views import ProfileMeView

urlpatterns = [
    path("me/", ProfileMeView.as_view(), name="profile-me"),
]
