"""
Unit tests for List CRUD and Task–List association.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import List, Task

User = get_user_model()

VALID_LIST = {"name": "Grocery shopping"}


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


class ListModelTests(TestCase):
    def setUp(self):
        self.user = _create_user()

    def test_create_list_with_defaults(self):
        lst = List.objects.create(user=self.user, name="My list")
        self.assertEqual(lst.priority, 0)
        self.assertEqual(lst.category, "")
        self.assertEqual(lst.tag, "")
        self.assertEqual(lst.sort_order, 0)
        self.assertIsNone(lst.muted_until)
        self.assertIsNone(lst.archived_at)
        self.assertIsNotNone(lst.created_at)

    def test_str_truncates(self):
        lst = List.objects.create(user=self.user, name="A" * 100)
        self.assertEqual(str(lst), "A" * 50)

    def test_cascade_delete_user(self):
        List.objects.create(user=self.user, name="L")
        self.user.delete()
        self.assertEqual(List.objects.count(), 0)

    def test_delete_list_nullifies_task_list_id(self):
        lst = List.objects.create(user=self.user, name="L")
        task = Task.objects.create(
            user=self.user, title="T", category="adulting", list=lst
        )
        lst.delete()
        task.refresh_from_db()
        self.assertIsNone(task.list_id)


# ── POST /api/lists/ ────────────────────────────────────────────────────


class ListCreateViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_create_minimal(self):
        resp = self.client.post("/api/lists/", VALID_LIST, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data["name"], "Grocery shopping")
        self.assertEqual(data["priority"], 0)
        self.assertEqual(data["task_count"], 0)
        self.assertIsNotNone(data["id"])

    def test_create_all_fields(self):
        payload = {
            "name": "Full list",
            "category": "glow_up",
            "tag": "health",
            "priority": 3,
            "sort_order": 5,
            "muted_until": "2026-03-25T10:00:00Z",
        }
        resp = self.client.post("/api/lists/", payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data["category"], "glow_up")
        self.assertEqual(data["priority"], 3)
        self.assertEqual(data["sort_order"], 5)

    def test_create_unauth_returns_401(self):
        resp = APIClient().post("/api/lists/", VALID_LIST, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_missing_name_returns_400(self):
        resp = self.client.post("/api/lists/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_name_too_long_returns_400(self):
        resp = self.client.post(
            "/api/lists/", {"name": "x" * 201}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_invalid_priority_returns_400(self):
        resp = self.client.post(
            "/api/lists/", {**VALID_LIST, "priority": 6}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_invalid_category_returns_400(self):
        resp = self.client.post(
            "/api/lists/", {**VALID_LIST, "category": "nonexistent"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


# ── GET /api/lists/ ──────────────────────────────────────────────────────


class ListListViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_list_returns_own_lists_only(self):
        List.objects.create(user=self.user, name="Mine")
        other = _create_user("other@example.com", "other", "Pass1234")
        List.objects.create(user=other, name="Theirs")

        resp = self.client.get("/api/lists/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["name"], "Mine")

    def test_list_unauth_returns_401(self):
        resp = APIClient().get("/api/lists/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_excludes_archived_by_default(self):
        List.objects.create(user=self.user, name="Active")
        List.objects.create(
            user=self.user,
            name="Archived",
            archived_at="2026-01-01T00:00:00Z",
        )
        resp = self.client.get("/api/lists/")
        self.assertEqual(resp.json()["count"], 1)
        self.assertEqual(resp.json()["results"][0]["name"], "Active")

    def test_list_includes_archived_when_requested(self):
        List.objects.create(user=self.user, name="Active")
        List.objects.create(
            user=self.user,
            name="Archived",
            archived_at="2026-01-01T00:00:00Z",
        )
        resp = self.client.get("/api/lists/?include_archived=true")
        self.assertEqual(resp.json()["count"], 2)

    def test_list_search_by_name(self):
        List.objects.create(user=self.user, name="Groceries")
        List.objects.create(user=self.user, name="Workout")

        resp = self.client.get("/api/lists/?search=groc")
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["name"], "Groceries")

    def test_list_pagination(self):
        for i in range(5):
            List.objects.create(user=self.user, name=f"List {i}")

        resp = self.client.get("/api/lists/?limit=2&offset=0")
        data = resp.json()
        self.assertEqual(data["count"], 5)
        self.assertEqual(data["limit"], 2)
        self.assertEqual(len(data["results"]), 2)

    def test_list_response_includes_task_count(self):
        lst = List.objects.create(user=self.user, name="L")
        Task.objects.create(user=self.user, title="T1", category="adulting", list=lst)
        Task.objects.create(user=self.user, title="T2", category="adulting", list=lst)

        resp = self.client.get("/api/lists/")
        self.assertEqual(resp.json()["results"][0]["task_count"], 2)


# ── GET/PATCH/DELETE /api/lists/{id}/ ────────────────────────────────────


class ListDetailViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")
        self.lst = List.objects.create(user=self.user, name="My list")

    def test_get_list(self):
        resp = self.client.get(f"/api/lists/{self.lst.id}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["name"], "My list")

    def test_get_other_users_list_returns_404(self):
        other = _create_user("other@example.com", "other", "Pass1234")
        other_list = List.objects.create(user=other, name="Not mine")
        resp = self.client.get(f"/api/lists/{other_list.id}/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_nonexistent_returns_404(self):
        resp = self.client.get("/api/lists/99999/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_name(self):
        resp = self.client.patch(
            f"/api/lists/{self.lst.id}/", {"name": "Updated"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["name"], "Updated")

    def test_patch_multiple_fields(self):
        resp = self.client.patch(
            f"/api/lists/{self.lst.id}/",
            {"name": "New", "priority": 4, "category": "glow_up"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["priority"], 4)
        self.assertEqual(data["category"], "glow_up")

    def test_patch_archived_at(self):
        resp = self.client.patch(
            f"/api/lists/{self.lst.id}/",
            {"archived_at": "2026-03-21T00:00:00Z"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(resp.json()["archived_at"])

    def test_patch_unarchive(self):
        self.lst.archived_at = "2026-01-01T00:00:00Z"
        self.lst.save()
        resp = self.client.patch(
            f"/api/lists/{self.lst.id}/",
            {"archived_at": None},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNone(resp.json()["archived_at"])

    def test_patch_muted_until(self):
        resp = self.client.patch(
            f"/api/lists/{self.lst.id}/",
            {"muted_until": "2026-04-01T00:00:00Z"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(resp.json()["muted_until"])

    def test_delete_returns_204(self):
        resp = self.client.delete(f"/api/lists/{self.lst.id}/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(List.objects.filter(id=self.lst.id).exists())

    def test_delete_nullifies_tasks(self):
        task = Task.objects.create(
            user=self.user, title="T", category="adulting", list=self.lst
        )
        self.client.delete(f"/api/lists/{self.lst.id}/")
        task.refresh_from_db()
        self.assertIsNone(task.list_id)

    def test_delete_other_users_list_returns_404(self):
        other = _create_user("other@example.com", "other", "Pass1234")
        other_list = List.objects.create(user=other, name="Not mine")
        resp = self.client.delete(f"/api/lists/{other_list.id}/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


# ── Task–List integration ────────────────────────────────────────────────


class TaskListIntegrationTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")
        self.lst = List.objects.create(user=self.user, name="My list")

    def test_create_task_with_list_id(self):
        resp = self.client.post(
            "/api/tasks/",
            {"title": "In list", "category": "adulting", "list_id": self.lst.id},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.json()["list_id"], self.lst.id)

    def test_create_task_with_invalid_list_id_returns_400(self):
        resp = self.client.post(
            "/api/tasks/",
            {"title": "Bad", "category": "adulting", "list_id": 99999},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_task_with_other_users_list_returns_400(self):
        other = _create_user("other@example.com", "other", "Pass1234")
        other_list = List.objects.create(user=other, name="Not mine")
        resp = self.client.post(
            "/api/tasks/",
            {"title": "Bad", "category": "adulting", "list_id": other_list.id},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_filter_tasks_by_list_id(self):
        Task.objects.create(
            user=self.user, title="In list", category="adulting", list=self.lst
        )
        Task.objects.create(
            user=self.user, title="No list", category="adulting"
        )

        resp = self.client.get(f"/api/tasks/?list_id={self.lst.id}")
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["title"], "In list")

    def test_filter_tasks_unassigned(self):
        Task.objects.create(
            user=self.user, title="In list", category="adulting", list=self.lst
        )
        Task.objects.create(
            user=self.user, title="No list", category="adulting"
        )

        resp = self.client.get("/api/tasks/?list_id=none")
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["title"], "No list")

    def test_move_task_to_list(self):
        task = Task.objects.create(
            user=self.user, title="T", category="adulting"
        )
        resp = self.client.patch(
            f"/api/tasks/{task.id}/",
            {"list_id": self.lst.id},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["list_id"], self.lst.id)

    def test_move_task_to_null(self):
        task = Task.objects.create(
            user=self.user, title="T", category="adulting", list=self.lst
        )
        resp = self.client.patch(
            f"/api/tasks/{task.id}/",
            {"list_id": None},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNone(resp.json()["list_id"])

    def test_move_task_to_other_users_list_returns_400(self):
        other = _create_user("other@example.com", "other", "Pass1234")
        other_list = List.objects.create(user=other, name="Not mine")
        task = Task.objects.create(
            user=self.user, title="T", category="adulting"
        )
        resp = self.client.patch(
            f"/api/tasks/{task.id}/",
            {"list_id": other_list.id},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_task_payload_includes_list_id(self):
        task = Task.objects.create(
            user=self.user, title="T", category="adulting", list=self.lst
        )
        resp = self.client.get(f"/api/tasks/{task.id}/")
        self.assertEqual(resp.json()["list_id"], self.lst.id)

    def test_task_payload_list_id_null_when_no_list(self):
        task = Task.objects.create(
            user=self.user, title="T", category="adulting"
        )
        resp = self.client.get(f"/api/tasks/{task.id}/")
        self.assertIsNone(resp.json()["list_id"])
