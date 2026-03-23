"""
Unit tests for DeviceToken model, device registration API, and stale token purge task.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.devices.tasks import purge_stale_device_tokens
from core.models import DeviceToken

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


# ── Model tests ──────────────────────────────────────────────────────────


class DeviceTokenModelTests(TestCase):
    def setUp(self):
        self.user = _create_user()

    def test_create_device_token(self):
        dt = DeviceToken.objects.create(
            user=self.user, token="abc123", platform="ios"
        )
        self.assertTrue(dt.is_active)
        self.assertIsNotNone(dt.created_at)
        self.assertIsNotNone(dt.updated_at)

    def test_token_unique_constraint(self):
        DeviceToken.objects.create(user=self.user, token="abc123", platform="ios")
        with self.assertRaises(IntegrityError):
            DeviceToken.objects.create(user=self.user, token="abc123", platform="android")

    def test_cascade_delete_user(self):
        DeviceToken.objects.create(user=self.user, token="abc123", platform="ios")
        self.assertEqual(DeviceToken.objects.count(), 1)
        self.user.delete()
        self.assertEqual(DeviceToken.objects.count(), 0)

    def test_str(self):
        dt = DeviceToken.objects.create(
            user=self.user, token="abc123", platform="android"
        )
        self.assertIn("android", str(dt))


# ── Register view tests ──────────────────────────────────────────────────


class DeviceRegisterViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_register_creates_token(self):
        resp = self.client.post(
            "/api/devices/register/",
            {"token": "fcm-token-1", "platform": "ios"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.json()["token"], "fcm-token-1")
        self.assertEqual(resp.json()["platform"], "ios")
        self.assertTrue(resp.json()["is_active"])
        self.assertEqual(DeviceToken.objects.count(), 1)

    def test_register_upsert_existing(self):
        DeviceToken.objects.create(user=self.user, token="fcm-token-1", platform="ios")
        resp = self.client.post(
            "/api/devices/register/",
            {"token": "fcm-token-1", "platform": "android"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["platform"], "android")
        self.assertEqual(DeviceToken.objects.count(), 1)

    def test_register_reactivates_inactive(self):
        DeviceToken.objects.create(
            user=self.user, token="fcm-token-1", platform="ios", is_active=False
        )
        resp = self.client.post(
            "/api/devices/register/",
            {"token": "fcm-token-1", "platform": "ios"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.json()["is_active"])

    def test_register_unauth_returns_401(self):
        client = APIClient()
        resp = client.post(
            "/api/devices/register/",
            {"token": "fcm-token-1", "platform": "ios"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_register_invalid_platform_returns_400(self):
        resp = self.client.post(
            "/api/devices/register/",
            {"token": "fcm-token-1", "platform": "windows"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_token_returns_400(self):
        resp = self.client.post(
            "/api/devices/register/",
            {"platform": "ios"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


# ── Deactivate view tests ────────────────────────────────────────────────


class DeviceDeactivateViewTests(TestCase):
    def setUp(self):
        self.user = _create_user()
        self.client = APIClient()
        _auth_client(self.client, "u@example.com", "Pass1234")

    def test_deactivate_sets_inactive(self):
        DeviceToken.objects.create(user=self.user, token="fcm-token-1", platform="ios")
        resp = self.client.delete("/api/devices/fcm-token-1/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        dt = DeviceToken.objects.get(token="fcm-token-1")
        self.assertFalse(dt.is_active)

    def test_deactivate_other_users_token_returns_404(self):
        other = _create_user(email="o@example.com", username="other")
        DeviceToken.objects.create(user=other, token="fcm-token-1", platform="ios")
        resp = self.client.delete("/api/devices/fcm-token-1/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_deactivate_nonexistent_returns_404(self):
        resp = self.client.delete("/api/devices/no-such-token/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_deactivate_unauth_returns_401(self):
        client = APIClient()
        resp = client.delete("/api/devices/fcm-token-1/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ── Purge task tests ─────────────────────────────────────────────────────


class PurgeStaleDeviceTokensTests(TestCase):
    def setUp(self):
        self.user = _create_user()

    def test_purges_old_inactive_tokens(self):
        dt = DeviceToken.objects.create(
            user=self.user, token="old-token", platform="ios", is_active=False
        )
        # Backdate updated_at past the 30-day cutoff.
        DeviceToken.objects.filter(pk=dt.pk).update(
            updated_at=timezone.now() - timedelta(days=31)
        )
        deleted = purge_stale_device_tokens()
        self.assertEqual(deleted, 1)
        self.assertEqual(DeviceToken.objects.count(), 0)

    def test_keeps_recent_inactive_tokens(self):
        DeviceToken.objects.create(
            user=self.user, token="recent-token", platform="ios", is_active=False
        )
        deleted = purge_stale_device_tokens()
        self.assertEqual(deleted, 0)
        self.assertEqual(DeviceToken.objects.count(), 1)

    def test_keeps_active_tokens(self):
        dt = DeviceToken.objects.create(
            user=self.user, token="active-token", platform="ios", is_active=True
        )
        DeviceToken.objects.filter(pk=dt.pk).update(
            updated_at=timezone.now() - timedelta(days=31)
        )
        deleted = purge_stale_device_tokens()
        self.assertEqual(deleted, 0)
        self.assertEqual(DeviceToken.objects.count(), 1)
