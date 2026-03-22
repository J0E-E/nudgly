"""
API URL root: mounts auth and profile under /api/.
"""

from django.urls import include, path

urlpatterns = [
    path("auth/", include("core.auth.urls")),
    path("users/", include("core.profile.urls")),
    path("tasks/", include("core.tasks.urls")),
    path("lists/", include("core.lists.urls")),
]
