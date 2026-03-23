"""
Unit tests for the notification interface, adapters, and worker integration.
"""

import logging
from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from core.models import DeviceToken, ReminderEvent, ReminderSchedule, Task
from core.notifications import get_notification_sender
from core.notifications.adapters.stdout_adapter import StdoutNotificationAdapter
from core.nudge import process_due_reminders

User = get_user_model()


def _create_user(email="u@example.com", username="user1", password="Pass1234"):
    return User.objects.create_user(email=email, username=username, password=password)


def _create_task(user, **kwargs):
    defaults = {"title": "Test task", "category": "adulting"}
    defaults.update(kwargs)
    return Task.objects.create(user=user, **defaults)


def _create_schedule(user, task, **kwargs):
    defaults = {
        "next_trigger_at": timezone.now() - timedelta(minutes=5),
        "retry_interval_minutes": 60,
        "max_attempts": 10,
    }
    defaults.update(kwargs)
    return ReminderSchedule.objects.create(user=user, task=task, **defaults)


# ── Stdout adapter tests ─────────────────────────────────────────────────


class StdoutNotificationAdapterTests(TestCase):
    def test_send_logs_user_title_body(self):
        with self.assertLogs(
            "core.notifications.adapters.stdout_adapter", level=logging.INFO
        ) as cm:
            adapter = StdoutNotificationAdapter()
            adapter.send(user_id=42, title="Nudge!", body="Time to do the thing")
        log_message = cm.records[0].message
        self.assertIn("42", log_message)
        self.assertIn("Nudge!", log_message)
        self.assertIn("Time to do the thing", log_message)

    def test_send_logs_data_when_provided(self):
        with self.assertLogs(
            "core.notifications.adapters.stdout_adapter", level=logging.INFO
        ) as cm:
            adapter = StdoutNotificationAdapter()
            adapter.send(
                user_id=1, title="T", body="B", data={"task_id": "99"}
            )
        self.assertIn("task_id", cm.records[0].message)

    def test_send_omits_data_when_none(self):
        with self.assertLogs(
            "core.notifications.adapters.stdout_adapter", level=logging.INFO
        ) as cm:
            adapter = StdoutNotificationAdapter()
            adapter.send(user_id=1, title="T", body="B", data=None)
        self.assertNotIn("Data:", cm.records[0].message)


# ── get_notification_sender tests ─────────────────────────────────────────


class GetNotificationSenderTests(TestCase):
    def _reset_cache(self):
        import core.notifications as mod

        mod._sender = None

    def test_returns_stdout_adapter_by_default(self):
        self._reset_cache()
        with patch("django.conf.settings.NOTIFICATION_SENDER", "stdout"):
            sender = get_notification_sender()
        self.assertIsInstance(sender, StdoutNotificationAdapter)

    def test_returned_object_has_send(self):
        self._reset_cache()
        with patch("django.conf.settings.NOTIFICATION_SENDER", "stdout"):
            sender = get_notification_sender()
        self.assertTrue(callable(getattr(sender, "send", None)))

    def test_returns_cached_instance_on_second_call(self):
        self._reset_cache()
        with patch("django.conf.settings.NOTIFICATION_SENDER", "stdout"):
            first = get_notification_sender()
            second = get_notification_sender()
        self.assertIs(first, second)

    def test_unknown_backend_falls_back_to_stdout(self):
        self._reset_cache()
        with patch("django.conf.settings.NOTIFICATION_SENDER", "carrier_pigeon"):
            sender = get_notification_sender()
        self.assertIsInstance(sender, StdoutNotificationAdapter)


# ── FCM adapter tests (mocked firebase-admin) ────────────────────────────


class FCMAdapterTests(TestCase):
    """Tests for FCMAdapter with firebase-admin fully mocked at import time."""

    def setUp(self):
        self.user = _create_user()
        DeviceToken.objects.create(user=self.user, token="tok-1", platform="ios")
        DeviceToken.objects.create(user=self.user, token="tok-2", platform="android")

        # Mock firebase_admin and sub-modules before importing the adapter.
        import sys

        self.mock_firebase_admin = MagicMock()
        self.mock_messaging = MagicMock()
        self.mock_credentials = MagicMock()
        self.mock_firebase_admin._apps = {"[DEFAULT]": True}
        self.mock_firebase_admin.credentials = self.mock_credentials

        sys.modules["firebase_admin"] = self.mock_firebase_admin
        sys.modules["firebase_admin.messaging"] = self.mock_messaging
        sys.modules["firebase_admin.credentials"] = self.mock_credentials

        # Force re-import of the adapter module so it picks up the mocks.
        sys.modules.pop("core.notifications.adapters.fcm_adapter", None)
        from core.notifications.adapters import fcm_adapter as fcm_mod

        self.fcm_mod = fcm_mod
        self.FCMAdapter = fcm_mod.FCMAdapter

    def tearDown(self):
        import sys

        sys.modules.pop("firebase_admin", None)
        sys.modules.pop("firebase_admin.messaging", None)
        sys.modules.pop("firebase_admin.credentials", None)
        sys.modules.pop("core.notifications.adapters.fcm_adapter", None)

    def test_send_calls_send_each_for_multicast(self):
        mock_response = MagicMock()
        mock_response.responses = []
        mock_response.success_count = 2
        mock_response.failure_count = 0
        self.fcm_mod.messaging.send_each_for_multicast.return_value = mock_response

        adapter = self.FCMAdapter()
        adapter.send(user_id=self.user.id, title="T", body="B")

        self.fcm_mod.messaging.send_each_for_multicast.assert_called_once()
        # Check the tokens passed to MulticastMessage constructor.
        mc_kwargs = self.fcm_mod.messaging.MulticastMessage.call_args[1]
        self.assertEqual(set(mc_kwargs["tokens"]), {"tok-1", "tok-2"})

    def test_send_no_tokens_skips(self):
        self.fcm_mod.messaging.reset_mock()
        other_user = _create_user(email="o@example.com", username="other")
        adapter = self.FCMAdapter()
        adapter.send(user_id=other_user.id, title="T", body="B")

        self.fcm_mod.messaging.send_each_for_multicast.assert_not_called()

    def test_send_deactivates_stale_token_on_unregistered(self):
        self.fcm_mod.messaging.reset_mock()
        mock_error = MagicMock()
        mock_error.code = "UNREGISTERED"

        resp_ok = MagicMock()
        resp_ok.exception = None
        resp_fail = MagicMock()
        resp_fail.exception = mock_error

        mock_response = MagicMock()
        mock_response.responses = [resp_ok, resp_fail]
        mock_response.success_count = 1
        mock_response.failure_count = 1
        self.fcm_mod.messaging.send_each_for_multicast.return_value = mock_response

        adapter = self.FCMAdapter()
        adapter.send(user_id=self.user.id, title="T", body="B")

        # One of the two tokens should be deactivated.
        inactive_count = DeviceToken.objects.filter(is_active=False).count()
        self.assertEqual(inactive_count, 1)


# ── Worker integration tests ─────────────────────────────────────────────


class NudgeEngineNotificationIntegrationTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.task = _create_task(self.user)

    @patch("core.nudge.get_notification_sender")
    def test_worker_calls_notification_sender(self, mock_get_sender):
        mock_sender = MagicMock()
        mock_get_sender.return_value = mock_sender

        _create_schedule(self.user, self.task)
        process_due_reminders()

        mock_sender.send.assert_called_once()
        call_kwargs = mock_sender.send.call_args[1]
        self.assertEqual(call_kwargs["user_id"], self.user.id)
        self.assertIn("Nudge!", call_kwargs["title"])
        self.assertIn(self.task.title, call_kwargs["body"])

        event = ReminderEvent.objects.first()
        self.assertTrue(event.notification_sent)

    @patch("core.nudge.get_notification_sender")
    def test_muted_task_does_not_call_sender(self, mock_get_sender):
        mock_sender = MagicMock()
        mock_get_sender.return_value = mock_sender

        self.task.muted_until = timezone.now() + timedelta(hours=1)
        self.task.save(update_fields=["muted_until"])
        _create_schedule(self.user, self.task)
        process_due_reminders()

        mock_sender.send.assert_not_called()
        event = ReminderEvent.objects.first()
        self.assertFalse(event.notification_sent)
