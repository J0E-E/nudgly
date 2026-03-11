"""
Unit tests for GET /health/ endpoint.
Covers 200 when DB and Redis available, 503 when unavailable, and JSON shape.
"""

from unittest.mock import patch

from django.test import TestCase


class HealthViewTests(TestCase):
    """Tests for the health/readiness endpoint."""

    def test_health_returns_200_when_all_ok(self):
        """When database and Redis are available, response is 200 with status ok."""
        with patch("core.views._check_database", return_value=True):
            with patch("core.views._check_redis", return_value=True):
                response = self.client.get("/health/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["database"], "ok")
        self.assertEqual(data["redis"], "ok")

    def test_health_returns_503_when_database_down(self):
        """When database is unavailable, response is 503 with database error."""
        with patch("core.views._check_database", return_value=False):
            with patch("core.views._check_redis", return_value=True):
                response = self.client.get("/health/")
        self.assertEqual(response.status_code, 503)
        data = response.json()
        self.assertEqual(data["status"], "error")
        self.assertEqual(data["database"], "error")
        self.assertEqual(data["redis"], "ok")

    def test_health_returns_503_when_redis_down(self):
        """When Redis is unavailable, response is 503 with redis error."""
        with patch("core.views._check_database", return_value=True):
            with patch("core.views._check_redis", return_value=False):
                response = self.client.get("/health/")
        self.assertEqual(response.status_code, 503)
        data = response.json()
        self.assertEqual(data["status"], "error")
        self.assertEqual(data["database"], "ok")
        self.assertEqual(data["redis"], "error")

    def test_health_returns_503_when_both_down(self):
        """When both database and Redis are down, response is 503."""
        with patch("core.views._check_database", return_value=False):
            with patch("core.views._check_redis", return_value=False):
                response = self.client.get("/health/")
        self.assertEqual(response.status_code, 503)
        data = response.json()
        self.assertEqual(data["status"], "error")
        self.assertEqual(data["database"], "error")
        self.assertEqual(data["redis"], "error")

    def test_health_json_shape_has_required_fields(self):
        """Response JSON always includes status, database, and redis."""
        with patch("core.views._check_database", return_value=True):
            with patch("core.views._check_redis", return_value=True):
                response = self.client.get("/health/")
        data = response.json()
        self.assertIn("status", data)
        self.assertIn("database", data)
        self.assertIn("redis", data)
        self.assertEqual(len(data), 3)

    def test_health_rejects_non_get(self):
        """Only GET is allowed; others return 405."""
        response = self.client.post("/health/")
        self.assertEqual(response.status_code, 405)
