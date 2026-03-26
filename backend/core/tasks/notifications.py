"""
Notifications for linked friends when a task is completed or overdue.
"""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from core.notifications import get_notification_sender

logger = logging.getLogger(__name__)


def notify_linked_friends(task, event_type):
    """
    Send push + WebSocket notifications to all linked friends of a task.
    event_type: "completed" or "overdue"
    """
    friends = list(task.linked_friends.all())
    if not friends:
        return

    owner_name = task.user.display_name or task.user.username
    sender = get_notification_sender()
    channel_layer = get_channel_layer()

    if event_type == "completed":
        title = f"{owner_name} completed a task!"
        body = f'"{task.title}" is done.'
    elif event_type == "overdue":
        title = f"{owner_name}'s task is overdue"
        body = f'"{task.title}" needs attention.'
    else:
        return

    data = {"task_id": str(task.id), "event_type": event_type}

    for friend in friends:
        sender.send(user_id=friend.pk, title=title, body=body, data=data)

        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"notifications_{friend.pk}",
                {
                    "type": "notify",
                    "data": {
                        "title": title,
                        "body": body,
                        "task_id": task.id,
                        "event_type": event_type,
                    },
                },
            )
