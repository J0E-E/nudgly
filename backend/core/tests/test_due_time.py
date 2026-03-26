"""
Tests for Epic 8f: Due time field on tasks.
Covers _compute_next_trigger with due_time, serializer validation,
payload inclusion, and schedule re-sync on time change.
"""

from datetime import date, time, timedelta
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import ReminderSchedule, Task
from core.schedules import _compute_next_trigger, sync_task_schedule

User = get_user_model()


def _create_user(email="u@example.com", username="user1", password="Pass1234", **kw):
    return User.objects.create_user(
        email=email, username=username, password=password, **kw
    )


def _create_task(user, **kwargs):
    defaults = {"title": "Test task", "category": "work"}
    defaults.update(kwargs)
    return Task.objects.create(user=user, **defaults)


def _auth_client(client, email, password):
    resp = client.post(
        "/api/auth/login/",
        {"email": email, "password": password},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.json()['access']}")
    return client


# ── _compute_next_trigger tests ──────────────────────────────────────────


class ComputeNextTriggerDueTimeTests(TestCase):
    def test_with_due_time_uses_custom_time(self):
        future = date.today() + timedelta(days=5)
        result = _compute_next_trigger(future, "UTC", due_time=time(14, 30))
        self.assertEqual(result.hour, 14)
        self.assertEqual(result.minute, 30)

    def test_without_due_time_defaults_to_9am(self):
        future = date.today() + timedelta(days=5)
        result = _compute_next_trigger(future, "UTC")
        self.assertEqual(result.hour, 9)
        self.assertEqual(result.minute, 0)

    def test_past_due_time_triggers_immediately(self):
        past = date.today() - timedelta(days=1)
        before = timezone.now()
        result = _compute_next_trigger(past, "UTC", due_time=time(8, 0))
        self.assertGreaterEqual(result, before)
        # Should be approximately now, not 8 AM yesterday.
        self.assertLessEqual(result - before, timedelta(seconds=5))

    def test_due_time_respects_timezone(self):
        future = date.today() + timedelta(days=5)
        result = _compute_next_trigger(future, "US/Eastern", due_time=time(14, 0))
        # 14:00 Eastern should be 18:00 or 19:00 UTC depending on DST.
        expected_local = result.astimezone(ZoneInfo("US/Eastern"))
        self.assertEqual(expected_local.hour, 14)
        self.assertEqual(expected_local.minute, 0)


# ── Serializer tests ────────────────────────────────────────────────────


class DueTimeSerializerTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = _auth_client(APIClient(), "u@example.com", "Pass1234")

    def test_create_task_with_due_time(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "Timed task",
                "category": "work",
                "due_date": "2026-04-15",
                "due_time": "14:30:00",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.json()["due_time"], "14:30:00")

    def test_create_task_due_time_without_due_date_fails(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "Bad task",
                "category": "work",
                "due_time": "14:30:00",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_task_payload_includes_due_time_null(self):
        resp = self.client.post(
            "/api/tasks/",
            {"title": "No time", "category": "work"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(resp.json()["due_time"])

    def test_patch_due_time(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "Patch me",
                "category": "work",
                "due_date": "2026-04-15",
            },
            format="json",
        )
        task_id = resp.json()["id"]
        resp = self.client.patch(
            f"/api/tasks/{task_id}/",
            {"due_time": "10:00:00"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["due_time"], "10:00:00")

    def test_patch_due_time_without_due_date_fails(self):
        resp = self.client.post(
            "/api/tasks/",
            {"title": "No date", "category": "work"},
            format="json",
        )
        task_id = resp.json()["id"]
        resp = self.client.patch(
            f"/api/tasks/{task_id}/",
            {"due_time": "10:00:00"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_clear_due_time(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "Clear time",
                "category": "work",
                "due_date": "2026-04-15",
                "due_time": "14:30:00",
            },
            format="json",
        )
        task_id = resp.json()["id"]
        resp = self.client.patch(
            f"/api/tasks/{task_id}/",
            {"due_time": None},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNone(resp.json()["due_time"])


# ── Schedule sync tests ─────────────────────────────────────────────────


class DueTimeScheduleSyncTests(TestCase):
    def setUp(self):
        self.user = _create_user()

    def test_sync_schedule_uses_due_time(self):
        task = _create_task(
            self.user,
            due_date=date.today() + timedelta(days=5),
            due_time=time(14, 30),
        )
        sync_task_schedule(task)
        schedule = ReminderSchedule.objects.get(task=task)
        trigger_local = schedule.next_trigger_at.astimezone(
            ZoneInfo(self.user.timezone)
        )
        self.assertEqual(trigger_local.hour, 14)
        self.assertEqual(trigger_local.minute, 30)

    def test_sync_schedule_defaults_9am_without_due_time(self):
        task = _create_task(
            self.user,
            due_date=date.today() + timedelta(days=5),
        )
        sync_task_schedule(task)
        schedule = ReminderSchedule.objects.get(task=task)
        trigger_local = schedule.next_trigger_at.astimezone(
            ZoneInfo(self.user.timezone)
        )
        self.assertEqual(trigger_local.hour, 9)
        self.assertEqual(trigger_local.minute, 0)

    def test_patch_due_time_resyncs_schedule(self):
        task = _create_task(
            self.user,
            due_date=date.today() + timedelta(days=5),
        )
        sync_task_schedule(task)
        schedule = ReminderSchedule.objects.get(task=task)
        original_trigger = schedule.next_trigger_at

        task.due_time = time(16, 0)
        task.save(update_fields=["due_time"])
        sync_task_schedule(task)

        schedule.refresh_from_db()
        self.assertNotEqual(schedule.next_trigger_at, original_trigger)
        trigger_local = schedule.next_trigger_at.astimezone(
            ZoneInfo(self.user.timezone)
        )
        self.assertEqual(trigger_local.hour, 16)
