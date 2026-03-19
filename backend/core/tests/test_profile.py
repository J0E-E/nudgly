"""
Unit tests for profile API: GET and PATCH /api/users/me/.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


def _auth_client(client, email, password):
    """Log in and set Bearer token on client."""
    resp = client.post(
        "/api/auth/login/",
        {"email": email, "password": password},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.json()['access']}")
    return client


class ProfileGetViewTests(TestCase):
    """GET /api/users/me/ — auth required; returns user with needs_profile_completion."""

    def setUp(self):
        self.client = APIClient()

    def test_get_without_token_returns_401(self):
        """No Authorization returns 401."""
        response = self.client.get("/api/users/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_with_valid_token_returns_user_payload(self):
        """Authenticated user gets id, email, username, timezone, display_name, needs_profile_completion."""
        User.objects.create_user(
            email="get@example.com", username="getuser", password="Pass1234"
        )
        _auth_client(self.client, "get@example.com", "Pass1234")
        response = self.client.get("/api/users/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["email"], "get@example.com")
        self.assertEqual(data["username"], "getuser")
        self.assertEqual(data["timezone"], "UTC")
        self.assertIn("display_name", data)
        self.assertIn("needs_profile_completion", data)
        self.assertFalse(data["needs_profile_completion"])

    def test_get_oauth_user_returns_needs_profile_completion_true(self):
        """User with no usable password (OAuth) returns needs_profile_completion true."""
        user = User.objects.create_user(
            email="oauth@example.com", username="user_abc123", password="Pass1234"
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])
        # Log in via JWT not possible without password; force credentials via token from another user or create token manually.
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}"
        )
        response = self.client.get("/api/users/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.json()["needs_profile_completion"])


class ProfilePatchViewTests(TestCase):
    """PATCH /api/users/me/ — timezone, display_name; profile completion (password + username)."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="patch@example.com", username="patchuser", password="Pass1234"
        )
        _auth_client(self.client, "patch@example.com", "Pass1234")

    def test_patch_timezone_returns_200_and_updated_payload(self):
        """Update timezone returns 200 and updated user."""
        response = self.client.patch(
            "/api/users/me/", {"timezone": "America/New_York"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["timezone"], "America/New_York")
        self.user.refresh_from_db()
        self.assertEqual(self.user.timezone, "America/New_York")

    def test_patch_display_name_returns_200(self):
        """Update display_name returns 200."""
        response = self.client.patch(
            "/api/users/me/", {"display_name": "My Name"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["display_name"], "My Name")
        self.user.refresh_from_db()
        self.assertEqual(self.user.display_name, "My Name")

    def test_patch_invalid_timezone_returns_400(self):
        """Empty timezone returns 400."""
        response = self.client.patch(
            "/api/users/me/", {"timezone": ""}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("timezone", response.json())

    def test_patch_partial_update_only_display_name(self):
        """Only send display_name; timezone unchanged."""
        response = self.client.patch(
            "/api/users/me/", {"display_name": "Display"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["display_name"], "Display")
        self.assertEqual(response.json()["timezone"], "UTC")


class ProfileCompletionTests(TestCase):
    """PATCH /api/users/me/ with password + username when user has no usable password."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="oauth2@example.com", username="user_placeholder", password="x"
        )
        self.user.set_unusable_password()
        self.user.save(update_fields=["password"])
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}"
        )

    def test_completion_with_password_and_username_returns_200(self):
        """PATCH with password and username (accept placeholder) completes profile."""
        response = self.client.patch(
            "/api/users/me/",
            {"password": "NewPass123", "username": "user_placeholder"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.json()["needs_profile_completion"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.has_usable_password())
        self.assertTrue(self.user.check_password("NewPass123"))

    def test_completion_with_new_username_returns_200(self):
        """PATCH with new username and password updates username."""
        response = self.client.patch(
            "/api/users/me/",
            {"password": "NewPass123", "username": "mynewhandle"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "mynewhandle")
        self.assertTrue(self.user.check_password("NewPass123"))

    def test_completion_without_password_returns_400(self):
        """PATCH without password when incomplete returns 400."""
        response = self.client.patch(
            "/api/users/me/",
            {"username": "user_placeholder"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.json())

    def test_completion_duplicate_username_returns_400(self):
        """New username already taken returns 400."""
        User.objects.create_user(
            email="other@example.com", username="taken", password="Pass1234"
        )
        response = self.client.patch(
            "/api/users/me/",
            {"password": "NewPass123", "username": "taken"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.json())

    def test_completion_weak_password_returns_400(self):
        """Invalid password strength returns 400."""
        response = self.client.patch(
            "/api/users/me/",
            {"password": "short", "username": "user_placeholder"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.json())

    def test_complete_user_cannot_send_password_in_patch(self):
        """User who already has password cannot set password via PATCH."""
        user = User.objects.create_user(
            email="full@example.com", username="fulluser", password="Pass1234"
        )
        _auth_client(self.client, "full@example.com", "Pass1234")
        response = self.client.patch(
            "/api/users/me/",
            {"password": "OtherPass1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.json())
