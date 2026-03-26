"""
Tests for friend request notifications.
Verifies that notify_friend_event is called at the correct points
in the friend services layer.
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from core.friends.services import accept_invite, decline_invite, send_invite
from core.models import FriendInvitation

User = get_user_model()


def _user(email, username):
    return User.objects.create_user(
        email=email, username=username, password="Pass1234"
    )


NOTIFY_PATH = "core.friends.services.notify_friend_event"


class SendInviteNotificationTests(TestCase):
    def setUp(self):
        self.alice = _user("alice@x.com", "alice")
        self.bob = _user("bob@x.com", "bob")

    @patch(NOTIFY_PATH)
    def test_username_invite_notifies_recipient(self, mock_notify):
        invitation, err = send_invite(self.alice, to_username="bob")
        self.assertIsNone(err)
        mock_notify.assert_called_once_with(
            self.bob, self.alice, "friend_request_received"
        )

    @patch(NOTIFY_PATH)
    def test_email_invite_existing_user_notifies_recipient(self, mock_notify):
        invitation, err = send_invite(self.alice, to_email="bob@x.com")
        self.assertIsNone(err)
        mock_notify.assert_called_once_with(
            self.bob, self.alice, "friend_request_received"
        )

    @patch(NOTIFY_PATH)
    @patch("core.friends.services._send_invite_email")
    def test_email_invite_nonuser_does_not_notify(self, mock_email, mock_notify):
        invitation, err = send_invite(self.alice, to_email="nobody@example.com")
        self.assertIsNone(err)
        mock_notify.assert_not_called()


class AcceptInviteNotificationTests(TestCase):
    def setUp(self):
        self.alice = _user("alice@x.com", "alice")
        self.bob = _user("bob@x.com", "bob")
        self.invitation = FriendInvitation.objects.create(
            from_user=self.alice, to_user=self.bob
        )

    @patch(NOTIFY_PATH)
    def test_accept_notifies_sender(self, mock_notify):
        err = accept_invite(self.invitation, self.bob)
        self.assertIsNone(err)
        mock_notify.assert_called_once_with(
            self.alice, self.bob, "friend_request_accepted"
        )


class DeclineInviteNotificationTests(TestCase):
    def setUp(self):
        self.alice = _user("alice@x.com", "alice")
        self.bob = _user("bob@x.com", "bob")
        self.invitation = FriendInvitation.objects.create(
            from_user=self.alice, to_user=self.bob
        )

    @patch(NOTIFY_PATH)
    def test_decline_notifies_sender(self, mock_notify):
        err = decline_invite(self.invitation, self.bob)
        self.assertIsNone(err)
        mock_notify.assert_called_once_with(
            self.alice, self.bob, "friend_request_declined"
        )
