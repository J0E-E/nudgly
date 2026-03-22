"""
Unit tests for Task CRUD: model, list/create, detail/update/delete.
"""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Task

User = get_user_model()

VALID_TASK = {
    "title": "Buy groceries",
    "category": "adulting",
}


def _auth_client(client, email, password):
    """Log in and set Bearer token on client."""
    resp = client.post(
        "/api/auth/login/",
        {"email": email, "password": password},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.json()['access']}")
    return client


def _create_user(email="u@example.com", username="user1", password="Pass1234"):
    """Create a user and return it."""
    return User.objects.create_user(email=email, username=username, password=password)


# ── Model tests ──────────────────────────────────────────────────────────


class TaskModelTests(TestCase):
    def setUp(self):
        self.user = _create_user()

    def test_create_task_with_defaults(self):
        task = Task.objects.create(user=self.user, title="Test", category="adulting")
        self.assertEqual(task.status, "pending")
        self.assertEqual(task.priority, 0)
        self.assertEqual(task.description, "")
        self.assertIsNone(task.due_date)
        self.assertIsNone(task.completed_at)
        self.assertIsNotNone(task.created_at)

    def test_str_truncates(self):
        task = Task.objects.create(user=self.user, title="A" * 100, category="adulting")
        self.assertEqual(str(task), "A" * 50)

    def test_cascade_delete_user(self):
        Task.objects.create(user=self.user, title="T", category="adulting")
        self.user.delete()
        self.assertEqual(Task.objects.count(), 0)


# ── POST /api/tasks/ ────────────────────────────────────────────────────


class TaskCreateViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_create_minimal(self):
        resp = self.client.post("/api/tasks/", VALID_TASK, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data["title"], "Buy groceries")
        self.assertEqual(data["category"], "adulting")
        self.assertEqual(data["status"], "pending")
        self.assertEqual(data["priority"], 0)
        self.assertIsNotNone(data["id"])

    def test_create_all_fields(self):
        payload = {
            "title": "Full task",
            "description": "Some details",
            "due_date": "2026-04-01",
            "category": "glow_up",
            "tag": "health",
            "priority": 3,
            "recurring": "RRULE:FREQ=DAILY",
            "status": "pending",
            "muted_until": "2026-03-25T10:00:00Z",
        }
        resp = self.client.post("/api/tasks/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data["due_date"], "2026-04-01")
        self.assertEqual(data["priority"], 3)
        self.assertEqual(data["tag"], "health")

    def test_create_unauth_returns_401(self):
        client = APIClient()
        resp = client.post("/api/tasks/", VALID_TASK, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_missing_title_returns_400(self):
        resp = self.client.post("/api/tasks/", {"category": "adulting"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_missing_category_returns_400(self):
        resp = self.client.post("/api/tasks/", {"title": "No category"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_invalid_category_returns_400(self):
        resp = self.client.post(
            "/api/tasks/",
            {"title": "Bad", "category": "nonexistent"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_invalid_priority_returns_400(self):
        resp = self.client.post(
            "/api/tasks/",
            {**VALID_TASK, "priority": 6},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_title_too_long_returns_400(self):
        resp = self.client.post(
            "/api/tasks/",
            {"title": "x" * 501, "category": "adulting"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_completed_sets_completed_at(self):
        resp = self.client.post(
            "/api/tasks/",
            {**VALID_TASK, "status": "completed"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(resp.json()["completed_at"])


# ── GET /api/tasks/ ──────────────────────────────────────────────────────


class TaskListViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_list_returns_own_tasks_only(self):
        Task.objects.create(user=self.user, title="Mine", category="adulting")
        other = _create_user("other@example.com", "other", "Pass1234")
        Task.objects.create(user=other, title="Theirs", category="adulting")

        resp = self.client.get("/api/tasks/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["title"], "Mine")

    def test_list_unauth_returns_401(self):
        resp = APIClient().get("/api/tasks/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_ordering_due_date_nulls_last(self):
        Task.objects.create(user=self.user, title="No date", category="adulting")
        Task.objects.create(
            user=self.user,
            title="Later",
            category="adulting",
            due_date=date(2026, 5, 1),
        )
        Task.objects.create(
            user=self.user,
            title="Sooner",
            category="adulting",
            due_date=date(2026, 4, 1),
        )

        resp = self.client.get("/api/tasks/")
        titles = [r["title"] for r in resp.json()["results"]]
        self.assertEqual(titles, ["Sooner", "Later", "No date"])

    def test_list_filter_by_status(self):
        Task.objects.create(user=self.user, title="A", category="adulting")
        Task.objects.create(
            user=self.user,
            title="B",
            category="adulting",
            status="completed",
        )

        resp = self.client.get("/api/tasks/?status=completed")
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["title"], "B")

    def test_list_pagination(self):
        for i in range(5):
            Task.objects.create(user=self.user, title=f"Task {i}", category="adulting")

        resp = self.client.get("/api/tasks/?limit=2&offset=0")
        data = resp.json()
        self.assertEqual(data["count"], 5)
        self.assertEqual(data["limit"], 2)
        self.assertEqual(data["offset"], 0)
        self.assertEqual(len(data["results"]), 2)

        resp2 = self.client.get("/api/tasks/?limit=2&offset=4")
        self.assertEqual(len(resp2.json()["results"]), 1)

    def test_list_max_limit_capped(self):
        resp = self.client.get("/api/tasks/?limit=200")
        self.assertEqual(resp.json()["limit"], 100)

    def test_list_response_shape(self):
        resp = self.client.get("/api/tasks/")
        data = resp.json()
        self.assertIn("count", data)
        self.assertIn("limit", data)
        self.assertIn("offset", data)
        self.assertIn("results", data)


# ── GET/PATCH/DELETE /api/tasks/{id}/ ────────────────────────────────────


class TaskDetailViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")
        self.task = Task.objects.create(
            user=self.user, title="My task", category="adulting"
        )

    def test_get_task(self):
        resp = self.client.get(f"/api/tasks/{self.task.id}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["title"], "My task")

    def test_get_other_users_task_returns_404(self):
        other = _create_user("other@example.com", "other", "Pass1234")
        other_task = Task.objects.create(
            user=other, title="Not mine", category="adulting"
        )
        resp = self.client.get(f"/api/tasks/{other_task.id}/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_nonexistent_returns_404(self):
        resp = self.client.get("/api/tasks/99999/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_title_only(self):
        resp = self.client.patch(
            f"/api/tasks/{self.task.id}/",
            {"title": "Updated"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["title"], "Updated")

    def test_patch_multiple_fields(self):
        resp = self.client.patch(
            f"/api/tasks/{self.task.id}/",
            {"title": "New", "priority": 4, "tag": "urgent"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["priority"], 4)
        self.assertEqual(data["tag"], "urgent")

    def test_patch_status_completed_sets_completed_at(self):
        resp = self.client.patch(
            f"/api/tasks/{self.task.id}/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(resp.json()["completed_at"])

    def test_patch_status_back_to_pending_clears_completed_at(self):
        self.client.patch(
            f"/api/tasks/{self.task.id}/",
            {"status": "completed"},
            format="json",
        )
        resp = self.client.patch(
            f"/api/tasks/{self.task.id}/",
            {"status": "pending"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNone(resp.json()["completed_at"])

    def test_patch_other_users_task_returns_404(self):
        other = _create_user("other@example.com", "other", "Pass1234")
        other_task = Task.objects.create(
            user=other, title="Not mine", category="adulting"
        )
        resp = self.client.patch(
            f"/api/tasks/{other_task.id}/",
            {"title": "Hacked"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_returns_204(self):
        resp = self.client.delete(f"/api/tasks/{self.task.id}/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Task.objects.filter(id=self.task.id).exists())

    def test_delete_other_users_task_returns_404(self):
        other = _create_user("other@example.com", "other", "Pass1234")
        other_task = Task.objects.create(
            user=other, title="Not mine", category="adulting"
        )
        resp = self.client.delete(f"/api/tasks/{other_task.id}/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    # ── Mute / Snooze ──────────────────────────────────────────────────

    def test_patch_mute_preset_1h(self):
        before = timezone.now()
        resp = self.client.patch(
            f"/api/tasks/{self.task.id}/",
            {"mute_preset": "1h"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        muted = resp.json()["muted_until"]
        self.assertIsNotNone(muted)
        from datetime import datetime

        muted_dt = datetime.fromisoformat(muted)
        expected_min = before + timedelta(hours=1) - timedelta(seconds=5)
        expected_max = before + timedelta(hours=1) + timedelta(seconds=5)
        self.assertGreaterEqual(muted_dt, expected_min)
        self.assertLessEqual(muted_dt, expected_max)

    def test_patch_mute_preset_1d(self):
        before = timezone.now()
        resp = self.client.patch(
            f"/api/tasks/{self.task.id}/",
            {"mute_preset": "1d"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        from datetime import datetime

        muted_dt = datetime.fromisoformat(resp.json()["muted_until"])
        expected = before + timedelta(days=1)
        self.assertAlmostEqual(muted_dt.timestamp(), expected.timestamp(), delta=5)

    def test_patch_mute_preset_1wk(self):
        before = timezone.now()
        resp = self.client.patch(
            f"/api/tasks/{self.task.id}/",
            {"mute_preset": "1wk"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        from datetime import datetime

        muted_dt = datetime.fromisoformat(resp.json()["muted_until"])
        expected = before + timedelta(weeks=1)
        self.assertAlmostEqual(muted_dt.timestamp(), expected.timestamp(), delta=5)

    def test_patch_muted_until_explicit(self):
        dt = "2026-06-01T12:00:00Z"
        resp = self.client.patch(
            f"/api/tasks/{self.task.id}/",
            {"muted_until": dt},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        from datetime import datetime

        stored = datetime.fromisoformat(resp.json()["muted_until"])
        expected = datetime.fromisoformat("2026-06-01T12:00:00+00:00")
        self.assertEqual(stored, expected)

    def test_patch_unmute(self):
        self.task.muted_until = timezone.now() + timedelta(hours=1)
        self.task.save()
        resp = self.client.patch(
            f"/api/tasks/{self.task.id}/",
            {"muted_until": None},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNone(resp.json()["muted_until"])

    def test_patch_mute_preset_and_muted_until_rejects(self):
        resp = self.client.patch(
            f"/api/tasks/{self.task.id}/",
            {"mute_preset": "1h", "muted_until": "2026-06-01T12:00:00Z"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_invalid_mute_preset_rejects(self):
        resp = self.client.patch(
            f"/api/tasks/{self.task.id}/",
            {"mute_preset": "2h"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
