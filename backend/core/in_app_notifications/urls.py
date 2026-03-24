from django.urls import path

from core.in_app_notifications.views import (
    MarkAllReadView,
    MarkReadView,
    NotificationListView,
    UnreadCountView,
)

urlpatterns = [
    path("", NotificationListView.as_view(), name="notification-list"),
    path("unread-count/", UnreadCountView.as_view(), name="notification-unread-count"),
    path("<int:pk>/read/", MarkReadView.as_view(), name="notification-mark-read"),
    path("read-all/", MarkAllReadView.as_view(), name="notification-read-all"),
]
