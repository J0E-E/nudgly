"""
Stdout adapter for the notification-sender interface.
Logs notification payload. For development and testing only.
"""

import logging

logger = logging.getLogger(__name__)


class StdoutNotificationAdapter:
    """Implements NotificationSender by logging. No FCM calls."""

    def send(
        self,
        user_id: int,
        title: str,
        body: str,
        data: dict | None = None,
    ) -> None:
        lines = [
            "--- Push Notification (stdout adapter) ---",
            f"User ID: {user_id}",
            f"Title: {title}",
            f"Body: {body}",
        ]
        if data:
            lines.append(f"Data: {data}")
        lines.append("---")
        logger.info("\n".join(lines))
