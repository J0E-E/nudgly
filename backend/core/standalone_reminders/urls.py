"""
URL patterns for /api/standalone-reminders/.
"""

from django.urls import path

from core.standalone_reminders.views import (
    ReminderInstanceClearView,
    ReminderInstanceSnoozeView,
    StandaloneReminderDetailView,
    StandaloneReminderListCreateView,
)

urlpatterns = [
    path("", StandaloneReminderListCreateView.as_view(), name="standalone-reminder-list-create"),
    path("<int:pk>/", StandaloneReminderDetailView.as_view(), name="standalone-reminder-detail"),
    path(
        "<int:pk>/instances/<int:instance_pk>/snooze/",
        ReminderInstanceSnoozeView.as_view(),
        name="reminder-instance-snooze",
    ),
    path(
        "<int:pk>/instances/<int:instance_pk>/clear/",
        ReminderInstanceClearView.as_view(),
        name="reminder-instance-clear",
    ),
]
