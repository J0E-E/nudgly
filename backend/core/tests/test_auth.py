"""
Unit tests for auth: register, login, logout, password reset, JWT protection.
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import PasswordResetToken

User = get_user_model()


class UserModelTests(TestCase):
    """User model: creation, uniqueness, password hashing."""

    def test_create_user_stores_hashed_password(self):
        """Password is hashed, not stored plain."""
        user = User.objects.create_user(
            email="u@example.com", username="user1", password="secret123"
        )
        self.assertNotEqual(user.password, "secret123")
        self.assertTrue(user.check_password("secret123"))

    def test_email_unique(self):
        """Duplicate email raises IntegrityError."""
        User.objects.create_user(
            email="same@example.com", username="first", password="x"
        )
        with self.assertRaises(Exception):
            User.objects.create_user(
                email="same@example.com", username="second", password="y"
            )

    def test_username_unique(self):
        """Duplicate username raises IntegrityError."""
        User.objects.create_user(email="a@example.com", username="same", password="x")
        with self.assertRaises(Exception):
            User.objects.create_user(
                email="b@example.com", username="same", password="y"
            )


class RegisterViewTests(TestCase):
    """POST /api/auth/register/ — success and validation."""

    def setUp(self):
        self.client = APIClient()

    def test_register_success_returns_201_and_tokens(self):
        """Valid payload creates user and returns user + access + refresh."""
        response = self.client.post(
            "/api/auth/register/",
            {"email": "new@example.com", "username": "newuser", "password": "Pass1234"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertIn("user", data)
        self.assertEqual(data["user"]["email"], "new@example.com")
        self.assertEqual(data["user"]["username"], "newuser")
        self.assertIn("access", data)
        self.assertIn("refresh", data)
        self.assertTrue(User.objects.filter(email="new@example.com").exists())

    def test_register_duplicate_email_returns_400(self):
        """Duplicate email returns validation error."""
        User.objects.create_user(
            email="taken@example.com", username="taken", password="x"
        )
        response = self.client.post(
            "/api/auth/register/",
            {"email": "taken@example.com", "username": "other", "password": "Pass1234"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.json())

    def test_register_duplicate_username_returns_400(self):
        """Duplicate username returns validation error."""
        User.objects.create_user(email="a@example.com", username="taken", password="x")
        response = self.client.post(
            "/api/auth/register/",
            {"email": "b@example.com", "username": "taken", "password": "Pass1234"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.json())

    def test_register_weak_password_returns_400(self):
        """Short or no-number password returns validation error."""
        response = self.client.post(
            "/api/auth/register/",
            {"email": "u@example.com", "username": "user1", "password": "short"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.json())


class LoginViewTests(TestCase):
    """POST /api/auth/login/ — success and invalid credentials."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="login@example.com", username="loginuser", password="Pass1234"
        )

    def test_login_success_returns_tokens_and_user(self):
        """Valid email/password returns access, refresh, and user."""
        response = self.client.post(
            "/api/auth/login/",
            {"email": "login@example.com", "password": "Pass1234"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["user"]["email"], "login@example.com")
        self.assertIn("access", data)
        self.assertIn("refresh", data)

    def test_login_invalid_password_returns_401(self):
        """Wrong password returns 401."""
        response = self.client.post(
            "/api/auth/login/",
            {"email": "login@example.com", "password": "wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_nonexistent_email_returns_401(self):
        """Unknown email returns 401."""
        response = self.client.post(
            "/api/auth/login/",
            {"email": "nobody@example.com", "password": "any"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class LogoutViewTests(TestCase):
    """POST /api/auth/logout/ — blacklist refresh token."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="out@example.com", username="outuser", password="Pass1234"
        )

    def test_logout_blacklists_refresh_returns_success(self):
        """Valid refresh token in body gets blacklisted; 200 (simplejwt default)."""
        login_resp = self.client.post(
            "/api/auth/login/",
            {"email": "out@example.com", "password": "Pass1234"},
            format="json",
        )
        refresh = login_resp.json()["refresh"]
        response = self.client.post(
            "/api/auth/logout/", {"refresh": refresh}, format="json"
        )
        self.assertIn(response.status_code, (200, 204))


class PasswordResetRequestViewTests(TestCase):
    """POST /api/auth/password-reset/ — no user enumeration."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="reset@example.com", username="resetuser", password="Pass1234"
        )

    @patch("core.auth.views.send_reset_email")
    def test_password_reset_existing_user_sends_email_returns_202(self, mock_send):
        """When user exists, send email and return 202."""
        response = self.client.post(
            "/api/auth/password-reset/",
            {"email": "reset@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        mock_send.assert_called_once()
        self.assertEqual(mock_send.call_args[0][0], "reset@example.com")
        self.assertEqual(len(mock_send.call_args[0][1]), 43)  # token length

    def test_password_reset_nonexistent_user_returns_202_no_email(self):
        """When user does not exist, still return 202 (no enumeration)."""
        with patch("core.auth.views.send_reset_email") as mock_send:
            response = self.client.post(
                "/api/auth/password-reset/",
                {"email": "nobody@example.com"},
                format="json",
            )
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        mock_send.assert_not_called()


class PasswordResetConfirmViewTests(TestCase):
    """POST /api/auth/password-reset/confirm/ — valid and invalid token."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="confirm@example.com", username="confirmuser", password="OldPass1"
        )

    def test_confirm_valid_token_updates_password_returns_204(self):
        """Valid token sets new password and returns 204."""
        from core.auth.password_reset_service import create_reset_token_for_user

        raw = create_reset_token_for_user(self.user)
        response = self.client.post(
            "/api/auth/password-reset/confirm/",
            {"token": raw, "new_password": "NewPass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPass123"))
        self.assertFalse(PasswordResetToken.objects.filter(user=self.user).exists())

    def test_confirm_invalid_token_returns_400(self):
        """Invalid token returns 400."""
        response = self.client.post(
            "/api/auth/password-reset/confirm/",
            {"token": "invalid-token", "new_password": "NewPass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class MeViewTests(TestCase):
    """GET /api/auth/me/ — requires JWT; returns current user."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="me@example.com", username="meuser", password="Pass1234"
        )

    def test_me_without_token_returns_401(self):
        """No Authorization header returns 401."""
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_with_valid_token_returns_user(self):
        """Valid access token returns current user payload."""
        login_resp = self.client.post(
            "/api/auth/login/",
            {"email": "me@example.com", "password": "Pass1234"},
            format="json",
        )
        access = login_resp.json()["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["email"], "me@example.com")
        self.assertEqual(data["username"], "meuser")
