"""
API URL root: mounts auth and profile under /api/.
"""

from django.urls import include, path

urlpatterns = [
    path("auth/", include("core.auth.urls")),
    path("users/", include("core.profile.urls")),
    path("tasks/", include("core.tasks.urls")),
    path("lists/", include("core.lists.urls")),
    path("reminders/", include("core.reminders.urls")),
    path("devices/", include("core.devices.urls")),
    path("notifications/", include("core.in_app_notifications.urls")),
    path("habits/", include("core.habits.urls")),
    path("friends/", include("core.friends.urls")),
]
