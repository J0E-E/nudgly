"""
URL patterns for reminder endpoints.
"""

from django.urls import path

from core.reminders.views import ReminderAcknowledgeView

urlpatterns = [
    path(
        "<int:schedule_id>/acknowledge/",
        ReminderAcknowledgeView.as_view(),
        name="reminder-acknowledge",
    ),
]
