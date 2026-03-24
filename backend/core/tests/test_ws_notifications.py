"""
Tests for WebSocket notification delivery (Epic 8j).

Verifies:
- NotificationConsumer joins/leaves channel group and forwards messages.
- Nudge engine sends to channel layer after event save.
"""

from datetime import timedelta
from unittest.mock import patch

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken

from config.asgi import application
from core.models import ReminderEvent, ReminderSchedule, Task

User = get_user_model()


class NotificationConsumerTests(TransactionTestCase):
    """Tests for the NotificationConsumer WebSocket consumer."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="ws@example.com", username="wsuser", password="Pass1234"
        )
        self.token = str(AccessToken.for_user(self.user))

    def test_connect_and_receive_notification(self):
        """Consumer connects, joins group, and receives channel-layer messages."""

        async def _test():
            communicator = WebsocketCommunicator(
                application, f"/ws/notifications/?token={self.token}"
            )
            connected, _ = await communicator.connect()
            self.assertTrue(connected)

            # Send a message via the channel layer group.
            channel_layer = get_channel_layer()
            payload = {
                "id": 1,
                "schedule_id": 1,
                "title": "Test title",
                "body": "Test body",
                "triggered_at": "2026-01-01T00:00:00+00:00",
                "read_at": None,
                "created_at": "2026-01-01T00:00:00+00:00",
            }
            await channel_layer.group_send(
                f"notifications_{self.user.id}",
                {"type": "notify", "data": payload},
            )

            response = await communicator.receive_json_from()
            self.assertEqual(response, payload)

            await communicator.disconnect()

        async_to_sync(_test)()

    def test_unauthenticated_rejected(self):
        """Connection without token is rejected."""

        async def _test():
            communicator = WebsocketCommunicator(
                application, "/ws/notifications/"
            )
            connected, _ = await communicator.connect()
            self.assertFalse(connected)

        async_to_sync(_test)()

    def test_multiple_messages(self):
        """Consumer receives multiple messages in order."""

        async def _test():
            communicator = WebsocketCommunicator(
                application, f"/ws/notifications/?token={self.token}"
            )
            connected, _ = await communicator.connect()
            self.assertTrue(connected)

            channel_layer = get_channel_layer()
            for i in range(3):
                await channel_layer.group_send(
                    f"notifications_{self.user.id}",
                    {"type": "notify", "data": {"seq": i}},
                )

            for i in range(3):
                response = await communicator.receive_json_from()
                self.assertEqual(response["seq"], i)

            await communicator.disconnect()

        async_to_sync(_test)()


class NudgeEngineChannelLayerTests(TransactionTestCase):
    """Integration: process_due_reminders sends to channel layer."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="nudge@example.com",
            username="nudgeuser",
            password="Pass1234",
        )
        self.task = Task.objects.create(
            user=self.user, title="Test task", category="adulting"
        )
        self.schedule = ReminderSchedule.objects.create(
            user=self.user,
            task=self.task,
            next_trigger_at=timezone.now() - timedelta(minutes=5),
            retry_interval_minutes=60,
            max_attempts=10,
        )

    @patch("core.nudge.get_notification_sender")
    def test_process_due_reminders_sends_to_channel_layer(self, mock_get_sender):
        """After processing a due reminder, a message is sent to the channel layer."""
        mock_sender = mock_get_sender.return_value
        sent_messages = []

        original_async_to_sync = async_to_sync

        def capture_async_to_sync(coroutine):
            """Wrap async_to_sync to capture group_send calls."""
            result = original_async_to_sync(coroutine)

            def wrapper(*args, **kwargs):
                sent_messages.append(args)
                return result(*args, **kwargs)

            return wrapper

        from core.nudge import process_due_reminders

        with patch("core.nudge.async_to_sync", side_effect=capture_async_to_sync):
            process_due_reminders()

        # Verify event was created and notification sent.
        event = ReminderEvent.objects.filter(
            schedule=self.schedule, notification_sent=True
        ).first()
        self.assertIsNotNone(event)
        self.assertTrue(event.title)
        self.assertTrue(event.body)

        # Verify push notification sender was called.
        mock_sender.send.assert_called_once()

        # Verify channel layer group_send was called with correct group and payload.
        self.assertTrue(len(sent_messages) > 0, "No channel layer messages sent")
        group_name, message = sent_messages[0]
        self.assertEqual(group_name, f"notifications_{self.user.id}")
        self.assertEqual(message["type"], "notify")
        self.assertEqual(message["data"]["id"], event.id)
        self.assertEqual(message["data"]["title"], event.title)
        self.assertEqual(message["data"]["body"], event.body)

    @patch("core.nudge.get_channel_layer", return_value=None)
    @patch("core.nudge.get_notification_sender")
    def test_no_channel_layer_does_not_crash(self, mock_get_sender, _mock_layer):
        """Nudge engine works even if channel layer is unavailable."""
        from core.nudge import process_due_reminders

        process_due_reminders()

        event = ReminderEvent.objects.filter(
            schedule=self.schedule, notification_sent=True
        ).first()
        self.assertIsNotNone(event)
        mock_get_sender.return_value.send.assert_called_once()
