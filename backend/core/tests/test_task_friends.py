"""
Tests for Epic 12: Friends – Task Linking & Create Task for Friend.
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.friends.services import create_friendship
from core.models import Task

User = get_user_model()

VALID_TASK = {"title": "Buy groceries", "category": "work"}


def _create_user(email="u@example.com", username="user1", password="Pass1234"):
    return User.objects.create_user(email=email, username=username, password=password)


def _auth_client(client, email, password):
    resp = client.post(
        "/api/auth/login/",
        {"email": email, "password": password},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.json()['access']}")
    return client


class TaskPayloadTests(TestCase):
    """task_payload includes created_by and linked_friends."""

    def setUp(self):
        self.alice = _create_user("a@x.com", "alice")
        self.bob = _create_user("b@x.com", "bob")
        create_friendship(self.alice, self.bob)
        self.client = APIClient()
        _auth_client(self.client, "a@x.com", "Pass1234")

    def test_task_payload_includes_created_by_and_linked_friends(self):
        resp = self.client.post(
            "/api/tasks/",
            {**VALID_TASK, "linked_friend_ids": [self.bob.pk]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertIsNone(data["created_by"])
        self.assertEqual(len(data["linked_friends"]), 1)
        self.assertEqual(data["linked_friends"][0]["id"], self.bob.pk)
        self.assertEqual(data["linked_friends"][0]["username"], "bob")

    def test_task_payload_created_by_populated(self):
        """When creating a task for a friend, created_by is set."""
        resp = self.client.post(
            "/api/tasks/",
            {**VALID_TASK, "created_for_user_id": self.bob.pk},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data["created_by"]["id"], self.alice.pk)
        self.assertEqual(data["created_by"]["username"], "alice")


class CreateTaskForFriendTests(TestCase):
    """POST /api/tasks/ with created_for_user_id."""

    def setUp(self):
        self.alice = _create_user("a@x.com", "alice")
        self.bob = _create_user("b@x.com", "bob")
        self.carol = _create_user("c@x.com", "carol")
        create_friendship(self.alice, self.bob)
        self.client = APIClient()
        _auth_client(self.client, "a@x.com", "Pass1234")

    def test_create_task_for_friend(self):
        resp = self.client.post(
            "/api/tasks/",
            {**VALID_TASK, "created_for_user_id": self.bob.pk},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        task = Task.objects.get(pk=resp.json()["id"])
        self.assertEqual(task.user_id, self.bob.pk)
        self.assertEqual(task.created_by_id, self.alice.pk)

    def test_create_task_for_non_friend_fails(self):
        resp = self.client.post(
            "/api/tasks/",
            {**VALID_TASK, "created_for_user_id": self.carol.pk},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("created_for_user_id", resp.json())

    def test_create_task_for_self_fails(self):
        resp = self.client.post(
            "/api/tasks/",
            {**VALID_TASK, "created_for_user_id": self.alice.pk},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("created_for_user_id", resp.json())

    def test_create_task_for_nonexistent_user_fails(self):
        resp = self.client.post(
            "/api/tasks/",
            {**VALID_TASK, "created_for_user_id": 99999},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class LinkedFriendCreateTests(TestCase):
    """POST /api/tasks/ with linked_friend_ids."""

    def setUp(self):
        self.alice = _create_user("a@x.com", "alice")
        self.bob = _create_user("b@x.com", "bob")
        self.carol = _create_user("c@x.com", "carol")
        create_friendship(self.alice, self.bob)
        self.client = APIClient()
        _auth_client(self.client, "a@x.com", "Pass1234")

    def test_create_task_with_linked_friends(self):
        resp = self.client.post(
            "/api/tasks/",
            {**VALID_TASK, "linked_friend_ids": [self.bob.pk]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        task = Task.objects.get(pk=resp.json()["id"])
        self.assertEqual(list(task.linked_friends.values_list("pk", flat=True)), [self.bob.pk])

    def test_create_task_with_non_friend_linked_fails(self):
        resp = self.client.post(
            "/api/tasks/",
            {**VALID_TASK, "linked_friend_ids": [self.carol.pk]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("linked_friend_ids", resp.json())

    def test_create_task_with_self_linked_fails(self):
        resp = self.client.post(
            "/api/tasks/",
            {**VALID_TASK, "linked_friend_ids": [self.alice.pk]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class LinkedFriendPatchTests(TestCase):
    """PATCH /api/tasks/{id}/ with linked_friend_ids."""

    def setUp(self):
        self.alice = _create_user("a@x.com", "alice")
        self.bob = _create_user("b@x.com", "bob")
        self.carol = _create_user("c@x.com", "carol")
        create_friendship(self.alice, self.bob)
        create_friendship(self.alice, self.carol)
        self.client = APIClient()
        _auth_client(self.client, "a@x.com", "Pass1234")
        resp = self.client.post("/api/tasks/", VALID_TASK, format="json")
        self.task_id = resp.json()["id"]

    def test_patch_linked_friends(self):
        resp = self.client.patch(
            f"/api/tasks/{self.task_id}/",
            {"linked_friend_ids": [self.bob.pk, self.carol.pk]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        friend_ids = sorted(f["id"] for f in data["linked_friends"])
        self.assertEqual(friend_ids, sorted([self.bob.pk, self.carol.pk]))

    def test_patch_clear_linked_friends(self):
        self.client.patch(
            f"/api/tasks/{self.task_id}/",
            {"linked_friend_ids": [self.bob.pk]},
            format="json",
        )
        resp = self.client.patch(
            f"/api/tasks/{self.task_id}/",
            {"linked_friend_ids": []},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["linked_friends"], [])

    def test_patch_linked_non_friend_fails(self):
        # Remove carol friendship
        from core.friends.services import remove_friendship

        remove_friendship(self.alice, self.carol)
        resp = self.client.patch(
            f"/api/tasks/{self.task_id}/",
            {"linked_friend_ids": [self.carol.pk]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class CreatedForMeFilterTests(TestCase):
    """GET /api/tasks/?created_for_me=true."""

    def setUp(self):
        self.alice = _create_user("a@x.com", "alice")
        self.bob = _create_user("b@x.com", "bob")
        create_friendship(self.alice, self.bob)

        # Alice creates a task for Bob.
        alice_client = APIClient()
        _auth_client(alice_client, "a@x.com", "Pass1234")
        alice_client.post(
            "/api/tasks/",
            {**VALID_TASK, "created_for_user_id": self.bob.pk},
            format="json",
        )

        # Bob creates his own task.
        self.bob_client = APIClient()
        _auth_client(self.bob_client, "b@x.com", "Pass1234")
        self.bob_client.post("/api/tasks/", VALID_TASK, format="json")

    def test_created_for_me_filter(self):
        resp = self.bob_client.get("/api/tasks/?created_for_me=true")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["created_by"]["username"], "alice")

    def test_all_tasks_includes_both(self):
        resp = self.bob_client.get("/api/tasks/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["count"], 2)

    def test_created_by_filter(self):
        resp = self.bob_client.get(f"/api/tasks/?created_by={self.alice.pk}")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["created_by"]["id"], self.alice.pk)


class CompletionNotificationTests(TestCase):
    """Completing a task with linked friends sends notifications."""

    def setUp(self):
        self.alice = _create_user("a@x.com", "alice")
        self.bob = _create_user("b@x.com", "bob")
        create_friendship(self.alice, self.bob)
        self.client = APIClient()
        _auth_client(self.client, "a@x.com", "Pass1234")

    @patch("core.tasks.notifications.get_notification_sender")
    @patch("core.tasks.notifications.get_channel_layer", return_value=None)
    def test_completion_notifies_linked_friends(self, _mock_channel, mock_sender):
        mock_send = mock_sender.return_value.send
        resp = self.client.post(
            "/api/tasks/",
            {**VALID_TASK, "linked_friend_ids": [self.bob.pk]},
            format="json",
        )
        task_id = resp.json()["id"]

        self.client.patch(
            f"/api/tasks/{task_id}/",
            {"status": "completed"},
            format="json",
        )

        mock_send.assert_called_once()
        call_kwargs = mock_send.call_args
        self.assertEqual(call_kwargs[1]["user_id"], self.bob.pk)
        self.assertIn("completed", call_kwargs[1]["data"]["event_type"])

    @patch("core.tasks.notifications.get_notification_sender")
    @patch("core.tasks.notifications.get_channel_layer", return_value=None)
    def test_no_notification_without_linked_friends(self, _mock_channel, mock_sender):
        mock_send = mock_sender.return_value.send
        resp = self.client.post("/api/tasks/", VALID_TASK, format="json")
        task_id = resp.json()["id"]

        self.client.patch(
            f"/api/tasks/{task_id}/",
            {"status": "completed"},
            format="json",
        )

        mock_send.assert_not_called()
