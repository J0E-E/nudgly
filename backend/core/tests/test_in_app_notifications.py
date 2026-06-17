"""
Tests for in-app notification endpoints: list, unread count, mark read, mark all read.
Also tests that the nudge engine persists title/body on ReminderEvent.
"""

from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import ReminderEvent, ReminderSchedule, Task
from core.nudge import process_due_reminders

User = get_user_model()

LIST_URL = "/api/notifications/"
UNREAD_COUNT_URL = "/api/notifications/unread-count/"
READ_ALL_URL = "/api/notifications/read-all/"


def _read_url(pk):
    return f"/api/notifications/{pk}/read/"


def _auth_client(client, email, password):
    resp = client.post(
        "/api/auth/login/",
        {"email": email, "password": password},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.json()['access']}")
    return client


def _create_user(email="u@example.com", username="user1", password="Pass1234"):
    return User.objects.create_user(email=email, username=username, password=password)


def _create_task(user, **kwargs):
    defaults = {"title": "Test task", "category": "work"}
    defaults.update(kwargs)
    return Task.objects.create(user=user, **defaults)


def _create_schedule(user, task, **kwargs):
    defaults = {
        "next_trigger_at": timezone.now() - timedelta(minutes=5),
    }
    defaults.update(kwargs)
    return ReminderSchedule.objects.create(user=user, task=task, **defaults)


def _create_sent_event(schedule, title="Hey!", body="Do the thing", **kwargs):
    now = timezone.now()
    defaults = {
        "triggered_at": now,
        "triggered_at_bucket": now.replace(second=0, microsecond=0),
        "attempt_number": 1,
        "notification_sent": True,
        "title": title,
        "body": body,
    }
    defaults.update(kwargs)
    return ReminderEvent.objects.create(schedule=schedule, **defaults)


# ── List endpoint tests ──────────────────────────────────────────────────


class NotificationListTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.task = _create_task(self.user)
        self.schedule = _create_schedule(self.user, self.task)
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_list_returns_sent_events_only(self):
        _create_sent_event(self.schedule, title="Sent")
        now = timezone.now() + timedelta(minutes=1)
        ReminderEvent.objects.create(
            schedule=self.schedule,
            triggered_at=now,
            triggered_at_bucket=now.replace(second=0, microsecond=0),
            attempt_number=2,
            notification_sent=False,
        )
        resp = self.client.get(LIST_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["count"], 1)
        self.assertEqual(resp.json()["results"][0]["title"], "Sent")

    def test_list_ordered_by_triggered_at_desc(self):
        t1 = timezone.now() - timedelta(minutes=10)
        t2 = timezone.now()
        _create_sent_event(
            self.schedule, title="Older",
            triggered_at=t1,
            triggered_at_bucket=t1.replace(second=0, microsecond=0),
            attempt_number=1,
        )
        _create_sent_event(
            self.schedule, title="Newer",
            triggered_at=t2,
            triggered_at_bucket=t2.replace(second=0, microsecond=0),
            attempt_number=2,
        )
        resp = self.client.get(LIST_URL)
        results = resp.json()["results"]
        self.assertEqual(results[0]["title"], "Newer")
        self.assertEqual(results[1]["title"], "Older")

    def test_list_pagination(self):
        for i in range(3):
            t = timezone.now() + timedelta(minutes=i)
            _create_sent_event(
                self.schedule,
                triggered_at=t,
                triggered_at_bucket=t.replace(second=0, microsecond=0),
                attempt_number=i + 1,
            )
        resp = self.client.get(LIST_URL, {"limit": 2, "offset": 0})
        data = resp.json()
        self.assertEqual(data["count"], 3)
        self.assertEqual(len(data["results"]), 2)

        resp2 = self.client.get(LIST_URL, {"limit": 2, "offset": 2})
        self.assertEqual(len(resp2.json()["results"]), 1)

    def test_unread_only_filter(self):
        read_event = _create_sent_event(
            self.schedule, title="Read", attempt_number=1,
        )
        read_event.read_at = timezone.now()
        read_event.save(update_fields=["read_at"])

        t2 = timezone.now() + timedelta(minutes=1)
        _create_sent_event(
            self.schedule, title="Unread", attempt_number=2,
            triggered_at=t2,
            triggered_at_bucket=t2.replace(second=0, microsecond=0),
        )

        resp = self.client.get(LIST_URL, {"unread_only": "true"})
        self.assertEqual(resp.json()["count"], 1)
        self.assertEqual(resp.json()["results"][0]["title"], "Unread")

    def test_requires_authentication(self):
        client = APIClient()
        resp = client.get(LIST_URL)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_isolation(self):
        _create_sent_event(self.schedule, title="User A event")

        user_b = _create_user(email="b@example.com", username="userb")
        client_b = APIClient()
        _auth_client(client_b, "b@example.com", "Pass1234")

        resp = client_b.get(LIST_URL)
        self.assertEqual(resp.json()["count"], 0)


# ── Unread count tests ───────────────────────────────────────────────────


class UnreadCountTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.task = _create_task(self.user)
        self.schedule = _create_schedule(self.user, self.task)
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_returns_unread_count(self):
        _create_sent_event(self.schedule, attempt_number=1)
        t2 = timezone.now() + timedelta(minutes=1)
        _create_sent_event(
            self.schedule, attempt_number=2,
            triggered_at=t2,
            triggered_at_bucket=t2.replace(second=0, microsecond=0),
        )
        read_event = _create_sent_event(
            self.schedule, attempt_number=3,
            triggered_at=t2 + timedelta(minutes=1),
            triggered_at_bucket=(t2 + timedelta(minutes=1)).replace(second=0, microsecond=0),
        )
        read_event.read_at = timezone.now()
        read_event.save(update_fields=["read_at"])

        resp = self.client.get(UNREAD_COUNT_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["count"], 2)

    def test_zero_when_all_read(self):
        event = _create_sent_event(self.schedule)
        event.read_at = timezone.now()
        event.save(update_fields=["read_at"])

        resp = self.client.get(UNREAD_COUNT_URL)
        self.assertEqual(resp.json()["count"], 0)

    def test_requires_authentication(self):
        client = APIClient()
        resp = client.get(UNREAD_COUNT_URL)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ── Mark read tests ──────────────────────────────────────────────────────


class MarkReadTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.task = _create_task(self.user)
        self.schedule = _create_schedule(self.user, self.task)
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_marks_event_as_read(self):
        event = _create_sent_event(self.schedule)
        resp = self.client.post(_read_url(event.pk))
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        event.refresh_from_db()
        self.assertIsNotNone(event.read_at)

    def test_idempotent(self):
        event = _create_sent_event(self.schedule)
        self.client.post(_read_url(event.pk))
        event.refresh_from_db()
        first_read_at = event.read_at

        self.client.post(_read_url(event.pk))
        event.refresh_from_db()
        self.assertEqual(event.read_at, first_read_at)

    def test_404_for_other_users_event(self):
        user_b = _create_user(email="b@example.com", username="userb")
        task_b = _create_task(user_b)
        schedule_b = _create_schedule(user_b, task_b)
        event_b = _create_sent_event(schedule_b)

        resp = self.client.post(_read_url(event_b.pk))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_404_for_unsent_event(self):
        now = timezone.now()
        event = ReminderEvent.objects.create(
            schedule=self.schedule,
            triggered_at=now,
            triggered_at_bucket=now.replace(second=0, microsecond=0),
            attempt_number=1,
            notification_sent=False,
        )
        resp = self.client.post(_read_url(event.pk))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_requires_authentication(self):
        event = _create_sent_event(self.schedule)
        client = APIClient()
        resp = client.post(_read_url(event.pk))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ── Mark all read tests ──────────────────────────────────────────────────


class MarkAllReadTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.task = _create_task(self.user)
        self.schedule = _create_schedule(self.user, self.task)
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_marks_all_unread_as_read(self):
        events = []
        for i in range(3):
            t = timezone.now() + timedelta(minutes=i)
            events.append(
                _create_sent_event(
                    self.schedule, attempt_number=i + 1,
                    triggered_at=t,
                    triggered_at_bucket=t.replace(second=0, microsecond=0),
                )
            )
        resp = self.client.post(READ_ALL_URL)
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        for e in events:
            e.refresh_from_db()
            self.assertIsNotNone(e.read_at)

    def test_does_not_change_already_read(self):
        event = _create_sent_event(self.schedule)
        old_read_at = timezone.now() - timedelta(hours=1)
        event.read_at = old_read_at
        event.save(update_fields=["read_at"])

        self.client.post(READ_ALL_URL)
        event.refresh_from_db()
        self.assertEqual(event.read_at, old_read_at)

    def test_requires_authentication(self):
        client = APIClient()
        resp = client.post(READ_ALL_URL)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ── Nudge engine title/body persistence tests ────────────────────────────


class NudgeEngineTitleBodyTests(TestCase):
    @patch("core.nudge.get_notification_sender")
    def test_title_and_body_stored_on_event(self, mock_get_sender):
        mock_sender = MagicMock()
        mock_get_sender.return_value = mock_sender

        user = _create_user()
        task = _create_task(user)
        _create_schedule(user, task)

        process_due_reminders()

        event = ReminderEvent.objects.first()
        self.assertTrue(event.notification_sent)
        self.assertTrue(len(event.title) > 0)
        self.assertTrue(len(event.body) > 0)

        call_kwargs = mock_sender.send.call_args[1]
        self.assertEqual(event.title, call_kwargs["title"])
        self.assertEqual(event.body, call_kwargs["body"])
