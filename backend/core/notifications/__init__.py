"""
Push notifications for Nudgly. Callers use get_notification_sender() and the
NotificationSender interface only.
Adapter is chosen by NOTIFICATION_SENDER setting (e.g. "stdout"); default is stdout.
"""

from django.conf import settings

from core.notifications.adapters.stdout_adapter import StdoutNotificationAdapter
from core.notifications.interface import NotificationSender

# Cached adapter instance; built lazily on first get_notification_sender() call.
_sender: NotificationSender | None = None


def get_notification_sender() -> NotificationSender:
    """
    Return the configured notification sender adapter. Reads settings.NOTIFICATION_SENDER;
    "stdout" (default) returns StdoutNotificationAdapter. "fcm" returns FCMAdapter.
    Unknown values fall back to stdout. Instance is cached after first call.
    """
    global _sender
    if _sender is not None:
        return _sender
    backend = getattr(settings, "NOTIFICATION_SENDER", "stdout")
    if backend == "fcm":
        from core.notifications.adapters.fcm_adapter import FCMAdapter

        _sender = FCMAdapter()
    else:
        _sender = StdoutNotificationAdapter()
    return _sender


__all__ = ["NotificationSender", "StdoutNotificationAdapter", "get_notification_sender"]
