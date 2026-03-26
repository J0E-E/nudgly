"""
Notifications for friend request events (sent, accepted, declined).
"""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from core.notifications import get_notification_sender

logger = logging.getLogger(__name__)


def notify_friend_event(recipient_user, actor_user, event_type):
    """
    Send push + WebSocket notification for a friend-request event.

    event_type: "friend_request_received" | "friend_request_accepted"
                | "friend_request_declined"
    """
    actor_name = actor_user.display_name or actor_user.username

    if event_type == "friend_request_received":
        title = "New friend request"
        body = f"{actor_name} sent you a friend request."
    elif event_type == "friend_request_accepted":
        title = "Friend request accepted"
        body = f"{actor_name} accepted your friend request."
    elif event_type == "friend_request_declined":
        title = "Friend request declined"
        body = f"{actor_name} declined your friend request."
    else:
        return

    data = {
        "msg_type": "friend_event",
        "event_type": event_type,
    }

    sender = get_notification_sender()
    sender.send(user_id=recipient_user.pk, title=title, body=body, data=data)

    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f"notifications_{recipient_user.pk}",
            {
                "type": "notify",
                "data": {
                    "title": title,
                    "body": body,
                    **data,
                },
            },
        )
