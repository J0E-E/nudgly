"""
Unit tests for OAuth: complete view (JWT redirect), adapters (random username).
"""

from unittest.mock import MagicMock

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from core.auth.adapters import (
    NudglySocialAccountAdapter,
    _random_username,
)

User = get_user_model()


class RandomUsernameTests(TestCase):
    """Placeholder username generation for new OAuth users."""

    def test_random_username_is_unique(self):
        """Generated usernames do not collide with existing users."""
        existing = _random_username()
        User.objects.create_user(
            email="a@example.com", username=existing, password="x"
        )
        for _ in range(5):
            new_username = _random_username()
            self.assertNotEqual(new_username, existing)
            self.assertTrue(new_username.startswith("user_"))
            self.assertFalse(User.objects.filter(username=new_username).exists())

    def test_random_username_format(self):
        """Username has expected prefix and length."""
        name = _random_username()
        self.assertTrue(name.startswith("user_"))
        self.assertGreater(len(name), 10)


class SocialAccountAdapterTests(TestCase):
    """NudglySocialAccountAdapter: populate_user sets username when missing."""

    def test_populate_user_sets_username_when_missing(self):
        """When data has no username, adapter sets random placeholder."""
        adapter = NudglySocialAccountAdapter()
        request = MagicMock()
        sociallogin = MagicMock()
        data = {"email": "oauth@example.com"}
        user = adapter.populate_user(request, sociallogin, data)
        self.assertIn("username", data)
        self.assertTrue(data["username"].startswith("user_"))
        self.assertEqual(user.email, "oauth@example.com")

    def test_populate_user_preserves_username_when_present(self):
        """When data has username, adapter leaves it unchanged."""
        adapter = NudglySocialAccountAdapter()
        request = MagicMock()
        sociallogin = MagicMock()
        data = {"email": "u@example.com", "username": "existing_name"}
        user = adapter.populate_user(request, sociallogin, data)
        self.assertEqual(data["username"], "existing_name")


class OAuthCompleteViewTests(TestCase):
    """GET /api/auth/oauth/complete/ — session user gets JWT redirect; anonymous gets error redirect."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="oauth@example.com", username="oauthuser", password="x"
        )

    def test_oauth_complete_authenticated_redirects_with_tokens(self):
        """When user is logged in via session, redirect to frontend with access and refresh in fragment."""
        self.client.force_login(self.user)
        response = self.client.get("/api/auth/oauth/complete/")
        self.assertEqual(response.status_code, 302)
        location = response.get("Location", "")
        frontend = settings.FRONTEND_ORIGIN.rstrip("/")
        self.assertTrue(
            location.startswith(frontend + "/auth/callback#"),
            msg=f"Expected redirect to {frontend}/auth/callback#... got {location}",
        )
        self.assertIn("access=", location)
        self.assertIn("refresh=", location)

    def test_oauth_complete_anonymous_redirects_to_login(self):
        """When user is not logged in, redirect to login with error param."""
        response = self.client.get("/api/auth/oauth/complete/")
        self.assertEqual(response.status_code, 302)
        location = response.get("Location", "")
        self.assertIn("/login", location)
        self.assertIn("oauth_error=", location)
