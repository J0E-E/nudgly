"""
Tests for Epic 11: Friends & Invitations.
Model constraints, service layer, and API endpoints.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.friends.services import (
    accept_invite,
    are_friends,
    create_friendship,
    decline_invite,
    get_friends,
    link_pending_invitations,
    remove_friendship,
    send_invite,
)
from core.models import FriendInvitation, Friendship

User = get_user_model()


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


# ── Model tests ─────────────────────────────────────────────────────────


class FriendshipModelTests(TestCase):
    def setUp(self):
        self.u1 = _create_user("a@x.com", "alice")
        self.u2 = _create_user("b@x.com", "bob")

    def test_create_friendship(self):
        create_friendship(self.u1, self.u2)
        self.assertTrue(Friendship.objects.filter(user=self.u1, friend=self.u2).exists())

    def test_normalized_order(self):
        """Friendship is always stored with lower pk first."""
        create_friendship(self.u2, self.u1)
        lo, hi = sorted([self.u1.pk, self.u2.pk])
        f = Friendship.objects.get()
        self.assertEqual(f.user_id, lo)
        self.assertEqual(f.friend_id, hi)

    def test_unique_constraint(self):
        create_friendship(self.u1, self.u2)
        # Creating again should not raise (get_or_create)
        create_friendship(self.u1, self.u2)
        self.assertEqual(Friendship.objects.count(), 1)


class FriendInvitationModelTests(TestCase):
    def setUp(self):
        self.u1 = _create_user("a@x.com", "alice")
        self.u2 = _create_user("b@x.com", "bob")

    def test_create_invitation_to_user(self):
        inv = FriendInvitation.objects.create(from_user=self.u1, to_user=self.u2)
        self.assertEqual(inv.status, "pending")
        self.assertIsNone(inv.responded_at)

    def test_create_invitation_to_email(self):
        inv = FriendInvitation.objects.create(
            from_user=self.u1, to_email="new@example.com"
        )
        self.assertIsNone(inv.to_user)
        self.assertEqual(inv.to_email, "new@example.com")


# ── Service tests ───────────────────────────────────────────────────────


class FriendServiceTests(TestCase):
    def setUp(self):
        self.u1 = _create_user("a@x.com", "alice")
        self.u2 = _create_user("b@x.com", "bob")
        self.u3 = _create_user("c@x.com", "carol")

    def test_are_friends(self):
        self.assertFalse(are_friends(self.u1, self.u2))
        create_friendship(self.u1, self.u2)
        self.assertTrue(are_friends(self.u1, self.u2))
        self.assertTrue(are_friends(self.u2, self.u1))

    def test_get_friends(self):
        create_friendship(self.u1, self.u2)
        create_friendship(self.u1, self.u3)
        friends = get_friends(self.u1)
        self.assertEqual(set(friends.values_list("pk", flat=True)), {self.u2.pk, self.u3.pk})

    def test_remove_friendship(self):
        create_friendship(self.u1, self.u2)
        remove_friendship(self.u2, self.u1)
        self.assertFalse(are_friends(self.u1, self.u2))

    def test_send_invite_by_username(self):
        inv, err = send_invite(self.u1, to_username="bob")
        self.assertIsNone(err)
        self.assertEqual(inv.to_user, self.u2)
        self.assertEqual(inv.status, "pending")

    def test_send_invite_self(self):
        _, err = send_invite(self.u1, to_username="alice")
        self.assertEqual(err, "You cannot invite yourself.")

    def test_send_invite_self_by_email(self):
        _, err = send_invite(self.u1, to_email="a@x.com")
        self.assertEqual(err, "You cannot invite yourself.")

    def test_send_invite_already_friends(self):
        create_friendship(self.u1, self.u2)
        _, err = send_invite(self.u1, to_username="bob")
        self.assertEqual(err, "You are already friends.")

    def test_send_invite_duplicate_pending(self):
        send_invite(self.u1, to_username="bob")
        _, err = send_invite(self.u1, to_username="bob")
        self.assertEqual(err, "Invitation already pending.")

    def test_send_invite_nonexistent_user(self):
        _, err = send_invite(self.u1, to_username="nobody")
        self.assertEqual(err, "User not found.")

    def test_send_invite_by_email_existing_user(self):
        inv, err = send_invite(self.u1, to_email="b@x.com")
        self.assertIsNone(err)
        self.assertEqual(inv.to_user, self.u2)

    def test_send_invite_by_email_nonuser(self):
        inv, err = send_invite(self.u1, to_email="new@example.com")
        self.assertIsNone(err)
        self.assertIsNone(inv.to_user)
        self.assertEqual(inv.to_email, "new@example.com")

    def test_accept_invite(self):
        inv, _ = send_invite(self.u1, to_username="bob")
        err = accept_invite(inv, self.u2)
        self.assertIsNone(err)
        inv.refresh_from_db()
        self.assertEqual(inv.status, "accepted")
        self.assertIsNotNone(inv.responded_at)
        self.assertTrue(are_friends(self.u1, self.u2))

    def test_decline_invite(self):
        inv, _ = send_invite(self.u1, to_username="bob")
        err = decline_invite(inv, self.u2)
        self.assertIsNone(err)
        inv.refresh_from_db()
        self.assertEqual(inv.status, "declined")
        self.assertFalse(are_friends(self.u1, self.u2))

    def test_accept_wrong_user(self):
        inv, _ = send_invite(self.u1, to_username="bob")
        err = accept_invite(inv, self.u3)
        self.assertEqual(err, "Not your invitation.")

    def test_accept_already_accepted(self):
        inv, _ = send_invite(self.u1, to_username="bob")
        accept_invite(inv, self.u2)
        err = accept_invite(inv, self.u2)
        self.assertEqual(err, "Invitation is not pending.")

    def test_link_pending_invitations(self):
        FriendInvitation.objects.create(
            from_user=self.u1, to_email="newuser@example.com"
        )
        new_user = _create_user("newuser@example.com", "newuser")
        link_pending_invitations(new_user)
        inv = FriendInvitation.objects.get(to_email="newuser@example.com")
        self.assertEqual(inv.to_user, new_user)
        self.assertEqual(inv.status, "pending")

    def test_no_input(self):
        _, err = send_invite(self.u1)
        self.assertEqual(err, "Provide to_username or to_email.")


# ── API tests ───────────────────────────────────────────────────────────


class FriendAPITests(TestCase):
    def setUp(self):
        self.u1 = _create_user("a@x.com", "alice")
        self.u2 = _create_user("b@x.com", "bob")
        self.u3 = _create_user("c@x.com", "carol")
        self.c1 = _auth_client(APIClient(), "a@x.com", "Pass1234")
        self.c2 = _auth_client(APIClient(), "b@x.com", "Pass1234")

    def test_invite_by_username(self):
        resp = self.c1.post(
            "/api/friends/invite/",
            {"to_username": "bob"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data["status"], "pending")
        self.assertEqual(data["to_user"]["username"], "bob")

    def test_invite_by_email_nonuser(self):
        resp = self.c1.post(
            "/api/friends/invite/",
            {"to_email": "outsider@example.com"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(resp.json()["to_user"])
        self.assertEqual(resp.json()["to_email"], "outsider@example.com")

    def test_invite_validation_both_fields(self):
        resp = self.c1.post(
            "/api/friends/invite/",
            {"to_email": "x@x.com", "to_username": "bob"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invite_validation_no_fields(self):
        resp = self.c1.post("/api/friends/invite/", {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_accept_invitation(self):
        self.c1.post(
            "/api/friends/invite/", {"to_username": "bob"}, format="json"
        )
        inv = FriendInvitation.objects.get()
        resp = self.c2.patch(
            f"/api/friends/invitations/{inv.pk}/",
            {"action": "accept"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["status"], "accepted")
        self.assertTrue(are_friends(self.u1, self.u2))

    def test_decline_invitation(self):
        self.c1.post(
            "/api/friends/invite/", {"to_username": "bob"}, format="json"
        )
        inv = FriendInvitation.objects.get()
        resp = self.c2.patch(
            f"/api/friends/invitations/{inv.pk}/",
            {"action": "decline"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["status"], "declined")
        self.assertFalse(are_friends(self.u1, self.u2))

    def test_accept_wrong_user(self):
        self.c1.post(
            "/api/friends/invite/", {"to_username": "bob"}, format="json"
        )
        inv = FriendInvitation.objects.get()
        c3 = _auth_client(APIClient(), "c@x.com", "Pass1234")
        resp = c3.patch(
            f"/api/friends/invitations/{inv.pk}/",
            {"action": "accept"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_friends(self):
        create_friendship(self.u1, self.u2)
        resp = self.c1.get("/api/friends/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.json()), 1)
        self.assertEqual(resp.json()[0]["username"], "bob")

    def test_list_friends_empty(self):
        resp = self.c1.get("/api/friends/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json(), [])

    def test_list_invitations_sent(self):
        self.c1.post(
            "/api/friends/invite/", {"to_username": "bob"}, format="json"
        )
        resp = self.c1.get("/api/friends/invitations/?direction=sent")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.json()), 1)

    def test_list_invitations_received(self):
        self.c1.post(
            "/api/friends/invite/", {"to_username": "bob"}, format="json"
        )
        resp = self.c2.get("/api/friends/invitations/?direction=received")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.json()), 1)

    def test_list_invitations_status_filter(self):
        self.c1.post(
            "/api/friends/invite/", {"to_username": "bob"}, format="json"
        )
        inv = FriendInvitation.objects.get()
        self.c2.patch(
            f"/api/friends/invitations/{inv.pk}/",
            {"action": "accept"},
            format="json",
        )
        resp = self.c1.get("/api/friends/invitations/?status=pending")
        self.assertEqual(len(resp.json()), 0)
        resp = self.c1.get("/api/friends/invitations/?status=accepted")
        self.assertEqual(len(resp.json()), 1)

    def test_remove_friend(self):
        create_friendship(self.u1, self.u2)
        resp = self.c1.delete(f"/api/friends/{self.u2.pk}/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(are_friends(self.u1, self.u2))

    def test_remove_non_friend(self):
        resp = self.c1.delete(f"/api/friends/{self.u2.pk}/")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invitation_not_found(self):
        resp = self.c1.patch(
            "/api/friends/invitations/9999/",
            {"action": "accept"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_remove_nonexistent_user(self):
        resp = self.c1.delete("/api/friends/9999/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_registration_links_pending_invitations(self):
        """Email-based invitation is linked to new user on registration."""
        self.c1.post(
            "/api/friends/invite/",
            {"to_email": "newbie@example.com"},
            format="json",
        )
        # Register with that email
        client = APIClient()
        resp = client.post(
            "/api/auth/register/",
            {
                "email": "newbie@example.com",
                "username": "newbie",
                "password": "Pass1234",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        inv = FriendInvitation.objects.get(to_email="newbie@example.com")
        new_user = User.objects.get(email="newbie@example.com")
        self.assertEqual(inv.to_user, new_user)
        self.assertEqual(inv.status, "pending")

    def test_unauthenticated_access(self):
        client = APIClient()
        resp = client.get("/api/friends/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
