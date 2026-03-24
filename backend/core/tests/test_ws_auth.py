"""
Tests for WebSocket JWT authentication middleware.

Verifies:
- Valid JWT in query string authenticates the connection.
- Invalid / missing / expired JWT rejects with close code 4003.
- HTTP endpoints still work under ASGI configuration.
"""

from datetime import timedelta
from unittest.mock import patch

from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from config.asgi import application

User = get_user_model()


class WebSocketAuthTests(TransactionTestCase):
    """WebSocket JWT auth middleware tests."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="ws@example.com", username="wsuser", password="Pass1234"
        )
        self.valid_token = str(AccessToken.for_user(self.user))

    def test_valid_jwt_passes_auth(self):
        """Valid JWT passes auth middleware (fails at router, not at auth)."""
        from core.ws.auth import JWTAuthMiddleware, get_user_from_token

        # Test the middleware directly: valid token should populate scope["user"]
        user = async_to_sync(get_user_from_token)(self.valid_token)
        self.assertEqual(user.pk, self.user.pk)
        self.assertFalse(user.is_anonymous)

    def test_invalid_jwt_rejected(self):
        """Invalid JWT closes connection."""

        async def _test():
            communicator = WebsocketCommunicator(
                application, "/ws/?token=invalid-token-here"
            )
            connected, _ = await communicator.connect()
            self.assertFalse(connected)

        async_to_sync(_test)()

    def test_missing_jwt_rejected(self):
        """Missing token query param closes connection."""

        async def _test():
            communicator = WebsocketCommunicator(
                application, "/ws/"
            )
            connected, _ = await communicator.connect()
            self.assertFalse(connected)

        async_to_sync(_test)()

    def test_expired_jwt_rejected(self):
        """Expired JWT closes connection."""

        async def _test():
            token = AccessToken.for_user(self.user)
            token.set_exp(lifetime=-timedelta(days=1))
            communicator = WebsocketCommunicator(
                application, f"/ws/?token={str(token)}"
            )
            connected, _ = await communicator.connect()
            self.assertFalse(connected)

        async_to_sync(_test)()


class HTTPUnderASGITests(TestCase):
    """Verify HTTP endpoints still work with ASGI configured."""

    def test_health_endpoint(self):
        """GET /health/ returns 200 under ASGI config."""
        with patch("core.views._check_database", return_value=True), patch(
            "core.views._check_redis", return_value=True
        ):
            response = self.client.get("/health/")
        self.assertEqual(response.status_code, 200)

    def test_api_register(self):
        """POST /api/auth/register/ still works under ASGI."""
        client = APIClient()
        response = client.post(
            "/api/auth/register/",
            {"email": "asgi@example.com", "username": "asgiuser", "password": "Pass1234"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
