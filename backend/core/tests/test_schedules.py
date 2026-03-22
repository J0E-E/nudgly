"""
Tests for Epic 8b: Schedule auto-creation/update/deactivation,
acknowledge endpoint, and task-schedule read endpoint.
"""

from datetime import date, timedelta
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import ReminderEvent, ReminderSchedule, Task
from core.nudge import PRIORITY_NUDGE_CONFIG
from core.schedules import sync_task_schedule

User = get_user_model()


def _create_user(email="u@example.com", username="user1", password="Pass1234", **kw):
    return User.objects.create_user(
        email=email, username=username, password=password, **kw
    )


def _create_task(user, **kwargs):
    defaults = {"title": "Test task", "category": "adulting"}
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


# ── sync_task_schedule unit tests ────────────────────────────────────────


class SyncTaskScheduleTests(TestCase):
    def setUp(self):
        self.user = _create_user()

    def test_creates_schedule_when_task_has_due_date(self):
        task = _create_task(self.user, due_date=date.today() + timedelta(days=3), priority=3)
        sync_task_schedule(task)

        schedule = ReminderSchedule.objects.get(task=task)
        cfg = PRIORITY_NUDGE_CONFIG[3]
        self.assertEqual(schedule.retry_interval_minutes, cfg["retry_interval_minutes"])
        self.assertEqual(schedule.max_attempts, cfg["max_attempts"])
        self.assertTrue(schedule.is_active)
        self.assertEqual(schedule.user, self.user)

    def test_no_schedule_when_no_due_date(self):
        task = _create_task(self.user)
        sync_task_schedule(task)

        self.assertFalse(ReminderSchedule.objects.filter(task=task).exists())

    def test_deactivates_on_completed(self):
        task = _create_task(self.user, due_date=date.today() + timedelta(days=1))
        sync_task_schedule(task)
        self.assertTrue(ReminderSchedule.objects.get(task=task).is_active)

        task.status = "completed"
        task.save(update_fields=["status"])
        sync_task_schedule(task)
        self.assertFalse(ReminderSchedule.objects.get(task=task).is_active)

    def test_deactivates_on_cancelled(self):
        task = _create_task(self.user, due_date=date.today() + timedelta(days=1))
        sync_task_schedule(task)

        task.status = "cancelled"
        task.save(update_fields=["status"])
        sync_task_schedule(task)
        self.assertFalse(ReminderSchedule.objects.get(task=task).is_active)

    def test_deactivates_on_due_date_cleared(self):
        task = _create_task(self.user, due_date=date.today() + timedelta(days=1))
        sync_task_schedule(task)

        task.due_date = None
        task.save(update_fields=["due_date"])
        sync_task_schedule(task)
        self.assertFalse(ReminderSchedule.objects.get(task=task).is_active)

    def test_reactivates_on_pending_with_due_date(self):
        task = _create_task(self.user, due_date=date.today() + timedelta(days=1))
        sync_task_schedule(task)

        # Deactivate.
        task.status = "completed"
        task.save(update_fields=["status"])
        sync_task_schedule(task)
        schedule = ReminderSchedule.objects.get(task=task)
        self.assertFalse(schedule.is_active)

        # Bump attempt_count to verify reset.
        schedule.attempt_count = 5
        schedule.save(update_fields=["attempt_count"])

        # Reactivate.
        task.status = "pending"
        task.due_date = date.today() + timedelta(days=2)
        task.save(update_fields=["status", "due_date"])
        sync_task_schedule(task)
        schedule.refresh_from_db()
        self.assertTrue(schedule.is_active)
        self.assertEqual(schedule.attempt_count, 0)

    def test_updates_retry_config_on_priority_change(self):
        task = _create_task(self.user, due_date=date.today() + timedelta(days=3), priority=1)
        sync_task_schedule(task)

        task.priority = 5
        task.save(update_fields=["priority"])
        sync_task_schedule(task)

        schedule = ReminderSchedule.objects.get(task=task)
        cfg = PRIORITY_NUDGE_CONFIG[5]
        self.assertEqual(schedule.retry_interval_minutes, cfg["retry_interval_minutes"])
        self.assertEqual(schedule.max_attempts, cfg["max_attempts"])

    def test_updates_next_trigger_on_due_date_change(self):
        task = _create_task(self.user, due_date=date.today() + timedelta(days=3))
        sync_task_schedule(task)
        original_trigger = ReminderSchedule.objects.get(task=task).next_trigger_at

        task.due_date = date.today() + timedelta(days=10)
        task.save(update_fields=["due_date"])
        sync_task_schedule(task)
        new_trigger = ReminderSchedule.objects.get(task=task).next_trigger_at
        self.assertGreater(new_trigger, original_trigger)

    def test_next_trigger_uses_user_timezone(self):
        user = _create_user(
            email="tz@example.com", username="tzuser", timezone="US/Eastern"
        )
        future = date.today() + timedelta(days=5)
        task = _create_task(user, due_date=future)
        sync_task_schedule(task)

        schedule = ReminderSchedule.objects.get(task=task)
        # 9 AM Eastern should differ from 9 AM UTC by the UTC offset.
        from datetime import datetime, time

        expected_local = datetime.combine(future, time(9, 0), tzinfo=ZoneInfo("US/Eastern"))
        expected_utc = expected_local.astimezone(ZoneInfo("UTC"))
        self.assertEqual(
            schedule.next_trigger_at.replace(microsecond=0),
            expected_utc.replace(microsecond=0),
        )

    def test_past_due_date_triggers_immediately(self):
        task = _create_task(self.user, due_date=date.today() - timedelta(days=3))
        before = timezone.now()
        sync_task_schedule(task)

        schedule = ReminderSchedule.objects.get(task=task)
        self.assertGreaterEqual(schedule.next_trigger_at, before)
        self.assertLessEqual(
            schedule.next_trigger_at, timezone.now() + timedelta(seconds=5)
        )

    def test_does_not_create_duplicate_schedules(self):
        task = _create_task(self.user, due_date=date.today() + timedelta(days=1))
        sync_task_schedule(task)
        sync_task_schedule(task)

        self.assertEqual(ReminderSchedule.objects.filter(task=task).count(), 1)

    def test_schedule_user_is_task_owner_not_created_by(self):
        creator = _create_user(email="c@example.com", username="creator")
        task = _create_task(
            self.user,
            due_date=date.today() + timedelta(days=1),
            created_by=creator,
        )
        sync_task_schedule(task)

        schedule = ReminderSchedule.objects.get(task=task)
        self.assertEqual(schedule.user, self.user)
        self.assertNotEqual(schedule.user, creator)


# ── API integration tests ────────────────────────────────────────────────


class TaskCreateScheduleTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_post_task_with_due_date_creates_schedule(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "Buy milk",
                "category": "adulting",
                "due_date": (date.today() + timedelta(days=2)).isoformat(),
                "priority": 2,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        task_id = resp.json()["id"]
        self.assertTrue(
            ReminderSchedule.objects.filter(task_id=task_id, is_active=True).exists()
        )

    def test_post_task_without_due_date_no_schedule(self):
        resp = self.client.post(
            "/api/tasks/",
            {"title": "Buy milk", "category": "adulting"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        task_id = resp.json()["id"]
        self.assertFalse(ReminderSchedule.objects.filter(task_id=task_id).exists())


class TaskPatchScheduleTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_patch_add_due_date_creates_schedule(self):
        resp = self.client.post(
            "/api/tasks/",
            {"title": "T", "category": "adulting"},
            format="json",
        )
        task_id = resp.json()["id"]
        self.assertFalse(ReminderSchedule.objects.filter(task_id=task_id).exists())

        self.client.patch(
            f"/api/tasks/{task_id}/",
            {"due_date": (date.today() + timedelta(days=1)).isoformat()},
            format="json",
        )
        self.assertTrue(
            ReminderSchedule.objects.filter(task_id=task_id, is_active=True).exists()
        )

    def test_patch_complete_deactivates_schedule(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "T",
                "category": "adulting",
                "due_date": (date.today() + timedelta(days=1)).isoformat(),
            },
            format="json",
        )
        task_id = resp.json()["id"]
        self.assertTrue(
            ReminderSchedule.objects.get(task_id=task_id).is_active
        )

        self.client.patch(
            f"/api/tasks/{task_id}/",
            {"status": "completed"},
            format="json",
        )
        self.assertFalse(
            ReminderSchedule.objects.get(task_id=task_id).is_active
        )

    def test_patch_back_to_pending_reactivates(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "T",
                "category": "adulting",
                "due_date": (date.today() + timedelta(days=1)).isoformat(),
            },
            format="json",
        )
        task_id = resp.json()["id"]
        self.client.patch(
            f"/api/tasks/{task_id}/",
            {"status": "completed"},
            format="json",
        )
        self.assertFalse(ReminderSchedule.objects.get(task_id=task_id).is_active)

        self.client.patch(
            f"/api/tasks/{task_id}/",
            {"status": "pending", "due_date": (date.today() + timedelta(days=2)).isoformat()},
            format="json",
        )
        schedule = ReminderSchedule.objects.get(task_id=task_id)
        self.assertTrue(schedule.is_active)
        self.assertEqual(schedule.attempt_count, 0)

    def test_delete_task_cascades_schedule(self):
        resp = self.client.post(
            "/api/tasks/",
            {
                "title": "T",
                "category": "adulting",
                "due_date": (date.today() + timedelta(days=1)).isoformat(),
            },
            format="json",
        )
        task_id = resp.json()["id"]
        schedule_id = ReminderSchedule.objects.get(task_id=task_id).id

        self.client.delete(f"/api/tasks/{task_id}/")
        self.assertFalse(ReminderSchedule.objects.filter(id=schedule_id).exists())


# ── Acknowledge endpoint tests ───────────────────────────────────────────


class ReminderAcknowledgeTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def _create_schedule_with_event(self):
        task = _create_task(self.user, due_date=date.today() + timedelta(days=1))
        sync_task_schedule(task)
        schedule = ReminderSchedule.objects.get(task=task)
        event = ReminderEvent.objects.create(
            schedule=schedule,
            triggered_at=timezone.now(),
            triggered_at_bucket=timezone.now().replace(second=0, microsecond=0),
            attempt_number=1,
        )
        return schedule, event

    def test_acknowledge_deactivates_and_marks_event(self):
        schedule, event = self._create_schedule_with_event()
        resp = self.client.post(f"/api/reminders/{schedule.id}/acknowledge/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

        event.refresh_from_db()
        schedule.refresh_from_db()
        self.assertTrue(event.acknowledged)
        self.assertFalse(schedule.is_active)

    def test_acknowledge_other_users_schedule_404(self):
        schedule, _ = self._create_schedule_with_event()

        other = _create_user(email="o@example.com", username="other")
        other_client = APIClient()
        _auth_client(other_client, "o@example.com", "Pass1234")

        resp = other_client.post(f"/api/reminders/{schedule.id}/acknowledge/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_acknowledge_nonexistent_404(self):
        resp = self.client.post("/api/reminders/99999/acknowledge/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_acknowledge_already_inactive_schedule(self):
        schedule, event = self._create_schedule_with_event()
        schedule.is_active = False
        schedule.save(update_fields=["is_active"])

        resp = self.client.post(f"/api/reminders/{schedule.id}/acknowledge/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        event.refresh_from_db()
        self.assertTrue(event.acknowledged)


# ── Task schedule read endpoint tests ────────────────────────────────────


class TaskScheduleReadTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_get_active_schedule(self):
        task = _create_task(self.user, due_date=date.today() + timedelta(days=3))
        sync_task_schedule(task)

        resp = self.client.get(f"/api/tasks/{task.id}/schedule/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertIn("id", data)
        self.assertIn("next_trigger_at", data)
        self.assertIn("retry_interval_minutes", data)
        self.assertIn("max_attempts", data)
        self.assertIn("attempt_count", data)
        self.assertTrue(data["is_active"])

    def test_get_schedule_no_active_returns_404(self):
        task = _create_task(self.user)
        resp = self.client.get(f"/api/tasks/{task.id}/schedule/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_schedule_other_users_task_404(self):
        task = _create_task(self.user, due_date=date.today() + timedelta(days=1))
        sync_task_schedule(task)

        other = _create_user(email="o@example.com", username="other")
        other_client = APIClient()
        _auth_client(other_client, "o@example.com", "Pass1234")

        resp = other_client.get(f"/api/tasks/{task.id}/schedule/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
