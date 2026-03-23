"""
FCM adapter: sends push notifications via firebase-admin SDK.
Requires GOOGLE_APPLICATION_CREDENTIALS env var to be set.
"""

import logging

from core.models import DeviceToken

logger = logging.getLogger(__name__)


def _ensure_firebase_app():
    """Initialize Firebase app once (lazy, on first use)."""
    import firebase_admin
    from firebase_admin import credentials

    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)


class FCMAdapter:
    """Implements NotificationSender using Firebase Cloud Messaging."""

    def __init__(self):
        _ensure_firebase_app()

    def send(
        self,
        user_id: int,
        title: str,
        body: str,
        data: dict | None = None,
    ) -> None:
        from firebase_admin import messaging

        tokens = list(
            DeviceToken.objects.filter(user_id=user_id, is_active=True).values_list(
                "token", flat=True
            )
        )
        if not tokens:
            logger.info("No active device tokens for user=%s", user_id)
            return

        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            tokens=tokens,
        )
        response = messaging.send_each_for_multicast(message)

        # Handle stale tokens.
        for i, send_response in enumerate(response.responses):
            if send_response.exception:
                error_code = send_response.exception.code
                if error_code in (
                    "NOT_FOUND",
                    "UNREGISTERED",
                    "INVALID_ARGUMENT",
                ):
                    DeviceToken.objects.filter(token=tokens[i]).update(is_active=False)
                    logger.info("Deactivated stale token: %s", tokens[i][:20])
                else:
                    logger.warning(
                        "FCM error for token %s: %s",
                        tokens[i][:20],
                        send_response.exception,
                    )

        logger.info(
            "FCM multicast: user=%s success=%d failure=%d",
            user_id,
            response.success_count,
            response.failure_count,
        )
