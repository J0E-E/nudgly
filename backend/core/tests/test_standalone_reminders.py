"""
Unit tests for StandaloneReminder CRUD, snooze, clear, and schedule sync.
"""

from datetime import datetime, time, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import ReminderInstance, ReminderSchedule, StandaloneReminder

User = get_user_model()

BASE_URL = "/api/standalone-reminders/"


def _create_user(email="u@example.com", username="user1", password="Pass1234"):
    return User.objects.create_user(
        email=email, username=username, password=password, timezone="America/New_York"
    )


def _auth_client(client, email, password):
    resp = client.post(
        "/api/auth/login/",
        {"email": email, "password": password},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.json()['access']}")
    return client


# ── Model tests ──────────────────────────────────────────────────────────


class StandaloneReminderModelTests(TestCase):
    def setUp(self):
        self.user = _create_user()

    def test_create_one_time_reminder(self):
        r = StandaloneReminder.objects.create(
            user=self.user,
            name="Pick up groceries",
            remind_at=timezone.now() + timedelta(hours=1),
        )
        self.assertTrue(r.is_active)
        self.assertIsNone(r.recurrence)
        self.assertIsNotNone(r.created_at)

    def test_create_recurring_reminder(self):
        r = StandaloneReminder.objects.create(
            user=self.user,
            name="Fasting start",
            remind_time=time(20, 0),
            recurrence="daily",
        )
        self.assertEqual(r.recurrence, "daily")
        self.assertEqual(r.remind_time, time(20, 0))

    def test_str_truncates(self):
        r = StandaloneReminder.objects.create(
            user=self.user,
            name="A" * 100,
            remind_at=timezone.now() + timedelta(hours=1),
        )
        self.assertEqual(str(r), "A" * 50)

    def test_cascade_delete_user(self):
        StandaloneReminder.objects.create(
            user=self.user,
            name="Test",
            remind_at=timezone.now() + timedelta(hours=1),
        )
        self.user.delete()
        self.assertEqual(StandaloneReminder.objects.count(), 0)

    def test_cascade_delete_reminder_instances(self):
        r = StandaloneReminder.objects.create(
            user=self.user,
            name="Test",
            remind_at=timezone.now() + timedelta(hours=1),
        )
        ReminderInstance.objects.create(reminder=r, due_at=timezone.now())
        self.assertEqual(ReminderInstance.objects.count(), 1)
        r.delete()
        self.assertEqual(ReminderInstance.objects.count(), 0)


# ── POST /api/standalone-reminders/ ──────────────────────────────────────


class CreateReminderViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = _auth_client(APIClient(), "u@example.com", "Pass1234")

    def test_create_one_time(self):
        remind_at = (timezone.now() + timedelta(hours=2)).isoformat()
        resp = self.client.post(
            BASE_URL,
            {"name": "Pickup at 3pm", "remind_at": remind_at},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data["name"], "Pickup at 3pm")
        self.assertIsNone(data["recurrence"])
        self.assertIsNotNone(data["remind_at"])
        # Schedule should be created.
        self.assertEqual(
            ReminderSchedule.objects.filter(
                standalone_reminder_id=data["id"], is_active=True
            ).count(),
            1,
        )

    def test_create_daily_recurring(self):
        resp = self.client.post(
            BASE_URL,
            {"name": "Fasting start", "recurrence": "daily", "remind_time": "20:00"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data["recurrence"], "daily")
        self.assertEqual(data["remind_time"], "20:00")

    def test_create_weekly_requires_day_of_week(self):
        resp = self.client.post(
            BASE_URL,
            {"name": "Show", "recurrence": "weekly", "remind_time": "21:00"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_weekly_with_day(self):
        resp = self.client.post(
            BASE_URL,
            {
                "name": "Show time",
                "recurrence": "weekly",
                "remind_time": "21:00",
                "day_of_week": 4,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.json()["day_of_week"], 4)

    def test_create_monthly(self):
        resp = self.client.post(
            BASE_URL,
            {
                "name": "Rent",
                "recurrence": "monthly",
                "remind_time": "09:00",
                "day_of_month": 1,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_create_yearly(self):
        resp = self.client.post(
            BASE_URL,
            {
                "name": "Anniversary",
                "recurrence": "yearly",
                "remind_time": "08:00",
                "day_of_month": 14,
                "month_of_year": 2,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_one_time_requires_remind_at(self):
        resp = self.client.post(
            BASE_URL,
            {"name": "No time"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_recurring_requires_remind_time(self):
        resp = self.client.post(
            BASE_URL,
            {"name": "No time", "recurrence": "daily"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated(self):
        client = APIClient()
        resp = client.post(BASE_URL, {"name": "X"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ── GET /api/standalone-reminders/ ───────────────────────────────────────


class ListReminderViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = _auth_client(APIClient(), "u@example.com", "Pass1234")

    def test_list_empty(self):
        resp = self.client.get(BASE_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["count"], 0)

    def test_list_returns_active_only(self):
        self.client.post(
            BASE_URL,
            {"name": "Active", "recurrence": "daily", "remind_time": "09:00"},
            format="json",
        )
        r = StandaloneReminder.objects.first()
        r.is_active = False
        r.save(update_fields=["is_active"])

        resp = self.client.get(BASE_URL)
        self.assertEqual(resp.json()["count"], 0)

    def test_list_includes_latest_instance(self):
        self.client.post(
            BASE_URL,
            {"name": "Test", "recurrence": "daily", "remind_time": "09:00"},
            format="json",
        )
        r = StandaloneReminder.objects.first()
        ReminderInstance.objects.create(
            reminder=r, due_at=timezone.now() - timedelta(hours=1)
        )
        resp = self.client.get(BASE_URL)
        data = resp.json()["results"][0]
        self.assertIsNotNone(data["latest_instance"])

    def test_isolation(self):
        """Other user's reminders not visible."""
        _create_user("other@example.com", "other", "Pass1234")
        other_client = _auth_client(APIClient(), "other@example.com", "Pass1234")
        other_client.post(
            BASE_URL,
            {"name": "Other", "recurrence": "daily", "remind_time": "09:00"},
            format="json",
        )
        resp = self.client.get(BASE_URL)
        self.assertEqual(resp.json()["count"], 0)


# ── GET/PATCH/DELETE /api/standalone-reminders/{id}/ ─────────────────────


class ReminderDetailViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = _auth_client(APIClient(), "u@example.com", "Pass1234")
        resp = self.client.post(
            BASE_URL,
            {"name": "Original", "recurrence": "daily", "remind_time": "10:00"},
            format="json",
        )
        self.reminder_id = resp.json()["id"]

    def test_get(self):
        resp = self.client.get(f"{BASE_URL}{self.reminder_id}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["name"], "Original")

    def test_patch_name(self):
        resp = self.client.patch(
            f"{BASE_URL}{self.reminder_id}/",
            {"name": "Updated"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["name"], "Updated")

    def test_patch_recurrence(self):
        resp = self.client.patch(
            f"{BASE_URL}{self.reminder_id}/",
            {"recurrence": "weekly", "day_of_week": 2},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["recurrence"], "weekly")

    def test_delete(self):
        resp = self.client.delete(f"{BASE_URL}{self.reminder_id}/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(StandaloneReminder.objects.count(), 0)

    def test_delete_cascades_schedules(self):
        self.client.delete(f"{BASE_URL}{self.reminder_id}/")
        self.assertEqual(
            ReminderSchedule.objects.filter(
                standalone_reminder_id=self.reminder_id
            ).count(),
            0,
        )

    def test_404_other_user(self):
        _create_user("other@example.com", "other", "Pass1234")
        other_client = _auth_client(APIClient(), "other@example.com", "Pass1234")
        resp = other_client.get(f"{BASE_URL}{self.reminder_id}/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# ── Snooze ───────────────────────────────────────────────────────────────


class SnoozeViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = _auth_client(APIClient(), "u@example.com", "Pass1234")
        resp = self.client.post(
            BASE_URL,
            {"name": "Test", "recurrence": "daily", "remind_time": "09:00"},
            format="json",
        )
        self.reminder_id = resp.json()["id"]
        self.reminder = StandaloneReminder.objects.get(pk=self.reminder_id)
        self.instance = ReminderInstance.objects.create(
            reminder=self.reminder, due_at=timezone.now()
        )

    def test_snooze_5_minutes(self):
        resp = self.client.post(
            f"{BASE_URL}{self.reminder_id}/instances/{self.instance.id}/snooze/",
            {"snooze_minutes": 5},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(resp.json()["snoozed_until"])

    def test_snooze_creates_schedule(self):
        self.client.post(
            f"{BASE_URL}{self.reminder_id}/instances/{self.instance.id}/snooze/",
            {"snooze_minutes": 15},
            format="json",
        )
        schedule = ReminderSchedule.objects.filter(
            standalone_reminder=self.reminder, is_active=True
        ).first()
        self.assertIsNotNone(schedule)

    def test_snooze_invalid_minutes(self):
        resp = self.client.post(
            f"{BASE_URL}{self.reminder_id}/instances/{self.instance.id}/snooze/",
            {"snooze_minutes": 7},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_snooze_cleared_instance_404(self):
        self.instance.cleared_at = timezone.now()
        self.instance.save(update_fields=["cleared_at"])
        resp = self.client.post(
            f"{BASE_URL}{self.reminder_id}/instances/{self.instance.id}/snooze/",
            {"snooze_minutes": 5},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# ── Clear ────────────────────────────────────────────────────────────────


class ClearViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = _auth_client(APIClient(), "u@example.com", "Pass1234")

    def test_clear_recurring(self):
        resp = self.client.post(
            BASE_URL,
            {"name": "Daily", "recurrence": "daily", "remind_time": "09:00"},
            format="json",
        )
        reminder_id = resp.json()["id"]
        reminder = StandaloneReminder.objects.get(pk=reminder_id)
        instance = ReminderInstance.objects.create(
            reminder=reminder, due_at=timezone.now()
        )

        resp = self.client.post(
            f"{BASE_URL}{reminder_id}/instances/{instance.id}/clear/",
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(resp.json()["cleared_at"])
        # Recurring reminder stays active.
        reminder.refresh_from_db()
        self.assertTrue(reminder.is_active)

    def test_clear_one_time_deactivates(self):
        remind_at = (timezone.now() + timedelta(hours=1)).isoformat()
        resp = self.client.post(
            BASE_URL,
            {"name": "One-time", "remind_at": remind_at},
            format="json",
        )
        reminder_id = resp.json()["id"]
        reminder = StandaloneReminder.objects.get(pk=reminder_id)
        instance = ReminderInstance.objects.create(
            reminder=reminder, due_at=timezone.now()
        )

        resp = self.client.post(
            f"{BASE_URL}{reminder_id}/instances/{instance.id}/clear/",
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        reminder.refresh_from_db()
        self.assertFalse(reminder.is_active)


# ── Schedule sync ────────────────────────────────────────────────────────


class ScheduleSyncTests(TestCase):
    def setUp(self):
        self.user = _create_user()

    def test_sync_one_time_creates_schedule(self):
        from core.schedules import sync_standalone_reminder_schedule

        r = StandaloneReminder.objects.create(
            user=self.user,
            name="Once",
            remind_at=timezone.now() + timedelta(hours=1),
        )
        sync_standalone_reminder_schedule(r)
        schedule = ReminderSchedule.objects.get(standalone_reminder=r)
        self.assertTrue(schedule.is_active)
        self.assertFalse(schedule.persistent)
        self.assertEqual(schedule.max_attempts, 1)

    def test_sync_recurring_creates_schedule(self):
        from core.schedules import sync_standalone_reminder_schedule

        r = StandaloneReminder.objects.create(
            user=self.user,
            name="Daily",
            remind_time=time(9, 0),
            recurrence="daily",
        )
        sync_standalone_reminder_schedule(r)
        schedule = ReminderSchedule.objects.get(standalone_reminder=r)
        self.assertTrue(schedule.is_active)

    def test_sync_inactive_deactivates(self):
        from core.schedules import sync_standalone_reminder_schedule

        r = StandaloneReminder.objects.create(
            user=self.user,
            name="Deactivated",
            remind_time=time(9, 0),
            recurrence="daily",
        )
        sync_standalone_reminder_schedule(r)
        r.is_active = False
        r.save(update_fields=["is_active"])
        sync_standalone_reminder_schedule(r)
        schedule = ReminderSchedule.objects.get(standalone_reminder=r)
        self.assertFalse(schedule.is_active)


# ── Nudge engine integration ─────────────────────────────────────────────


class NudgeEngineTests(TestCase):
    def setUp(self):
        self.user = _create_user()

    @patch("core.nudge.get_notification_sender")
    @patch("core.nudge.get_channel_layer", return_value=None)
    def test_nudge_creates_instance_for_recurring(self, _mock_cl, mock_sender):
        mock_sender.return_value.send = lambda **kw: None
        from core.schedules import sync_standalone_reminder_schedule

        r = StandaloneReminder.objects.create(
            user=self.user,
            name="Nudge test",
            remind_time=time(9, 0),
            recurrence="daily",
        )
        sync_standalone_reminder_schedule(r)
        schedule = ReminderSchedule.objects.get(standalone_reminder=r)
        # Set trigger to past so it fires.
        schedule.next_trigger_at = timezone.now() - timedelta(minutes=1)
        schedule.save(update_fields=["next_trigger_at"])

        from core.nudge import process_due_reminders

        process_due_reminders()

        # Instance should be created.
        self.assertEqual(ReminderInstance.objects.filter(reminder=r).count(), 1)
        # Schedule should advance (still active for recurring).
        schedule.refresh_from_db()
        self.assertTrue(schedule.is_active)
        self.assertTrue(schedule.next_trigger_at > timezone.now())

    @patch("core.nudge.get_notification_sender")
    @patch("core.nudge.get_channel_layer", return_value=None)
    def test_nudge_deactivates_one_time(self, _mock_cl, mock_sender):
        mock_sender.return_value.send = lambda **kw: None
        from core.schedules import sync_standalone_reminder_schedule

        r = StandaloneReminder.objects.create(
            user=self.user,
            name="One-time nudge",
            remind_at=timezone.now() - timedelta(minutes=1),
        )
        sync_standalone_reminder_schedule(r)
        schedule = ReminderSchedule.objects.get(standalone_reminder=r)

        from core.nudge import process_due_reminders

        process_due_reminders()

        schedule.refresh_from_db()
        self.assertFalse(schedule.is_active)
        self.assertEqual(ReminderInstance.objects.filter(reminder=r).count(), 1)


# ── compute_next_standalone_trigger ──────────────────────────────────────


class ComputeNextTriggerTests(TestCase):
    def test_daily_future_today(self):
        from core.schedules import compute_next_standalone_trigger

        # Use a time far in the future today.
        result = compute_next_standalone_trigger(
            "daily", time(23, 59), None, None, None, "UTC"
        )
        self.assertIsNotNone(result)
        self.assertTrue(result > timezone.now())

    def test_weekly(self):
        from core.schedules import compute_next_standalone_trigger

        result = compute_next_standalone_trigger(
            "weekly", time(10, 0), 0, None, None, "UTC"  # Monday
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.weekday(), 0)

    def test_monthly(self):
        from core.schedules import compute_next_standalone_trigger

        result = compute_next_standalone_trigger(
            "monthly", time(9, 0), None, 15, None, "UTC"
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.day, 15)

    def test_yearly(self):
        from core.schedules import compute_next_standalone_trigger

        result = compute_next_standalone_trigger(
            "yearly", time(8, 0), None, 14, 2, "UTC"  # Feb 14
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.month, 2)
        self.assertEqual(result.day, 14)
