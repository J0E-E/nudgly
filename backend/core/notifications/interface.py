"""
Notification-sender interface (protocol) for Nudgly.
Callers depend on this contract only; concrete adapters (stdout, FCM, etc.) implement it.
"""

from typing import Protocol


class NotificationSender(Protocol):
    """
    Contract for sending push notifications. All callers (e.g. nudge engine)
    must use get_notification_sender(); do not depend on a concrete implementation.

    Implementations may raise on delivery failure; callers should handle exceptions.
    """

    def send(
        self,
        user_id: int,
        title: str,
        body: str,
        data: dict | None = None,
    ) -> None:
        """
        Send a push notification to all active devices for the given user.

        Args:
            user_id: Target user's PK.
            title: Notification title.
            body: Notification body text.
            data: Optional data payload (key-value pairs).

        Raises:
            Implementations may raise on delivery failure.
        """
        ...
