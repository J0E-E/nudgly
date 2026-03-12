"""
Unit tests for the email interface and stdout adapter.
Covers StdoutAdapter output and get_email_sender() returning a working adapter.
"""

import logging
from unittest.mock import patch

from django.test import TestCase

from core.email import get_email_sender
from core.email.adapters.stdout_adapter import StdoutAdapter


class StdoutAdapterTests(TestCase):
    """Tests for StdoutAdapter: send_email logs the expected payload."""

    def test_send_email_logs_to_subject_and_plain_body(self):
        """Log record contains to, subject, and body_plain."""
        with self.assertLogs(
            "core.email.adapters.stdout_adapter", level=logging.INFO
        ) as cm:
            adapter = StdoutAdapter()
            adapter.send_email(
                to="user@example.com",
                subject="Test Subject",
                body_plain="Plain body text",
            )
        self.assertEqual(len(cm.records), 1)
        log_message = cm.records[0].message
        self.assertIn("user@example.com", log_message)
        self.assertIn("Test Subject", log_message)
        self.assertIn("Plain body text", log_message)

    def test_send_email_with_list_of_recipients(self):
        """Multiple recipients are logged as comma-separated."""
        with self.assertLogs(
            "core.email.adapters.stdout_adapter", level=logging.INFO
        ) as cm:
            adapter = StdoutAdapter()
            adapter.send_email(
                to=["a@example.com", "b@example.com"],
                subject="Multi",
                body_plain="Body",
            )
        self.assertIn("a@example.com", cm.records[0].message)
        self.assertIn("b@example.com", cm.records[0].message)

    def test_send_email_includes_body_html_when_provided(self):
        """When body_html is set, it appears in the log."""
        with self.assertLogs(
            "core.email.adapters.stdout_adapter", level=logging.INFO
        ) as cm:
            adapter = StdoutAdapter()
            adapter.send_email(
                to="u@ex.com",
                subject="Sub",
                body_plain="Plain",
                body_html="<p>HTML</p>",
            )
        self.assertIn("HTML", cm.records[0].message)
        self.assertIn("<p>HTML</p>", cm.records[0].message)

    def test_send_email_includes_reply_to_when_provided(self):
        """When reply_to is set, it appears in the log."""
        with self.assertLogs(
            "core.email.adapters.stdout_adapter", level=logging.INFO
        ) as cm:
            adapter = StdoutAdapter()
            adapter.send_email(
                to="u@ex.com",
                subject="Sub",
                body_plain="Plain",
                reply_to="reply@example.com",
            )
        self.assertIn("reply@example.com", cm.records[0].message)


class GetEmailSenderTests(TestCase):
    """Tests for get_email_sender(): returns adapter that fulfills the interface."""

    def test_get_email_sender_returns_stdout_adapter_by_default(self):
        """With EMAIL_SENDER=stdout or unset, get_email_sender returns StdoutAdapter."""
        # Reset module-level cache so settings patch takes effect.
        import core.email as email_module

        email_module._sender = None
        with patch("django.conf.settings.EMAIL_SENDER", "stdout"):
            sender = get_email_sender()
        self.assertIsInstance(sender, StdoutAdapter)

    def test_get_email_sender_returned_object_has_send_email(self):
        """Returned sender has send_email and a call succeeds without error."""
        import core.email as email_module

        email_module._sender = None
        with patch("django.conf.settings.EMAIL_SENDER", "stdout"):
            sender = get_email_sender()
        self.assertTrue(callable(getattr(sender, "send_email", None)))
        with self.assertLogs("core.email.adapters.stdout_adapter", level=logging.INFO):
            sender.send_email(
                to="test@example.com",
                subject="S",
                body_plain="P",
            )

    def test_get_email_sender_returns_cached_instance_on_second_call(self):
        """Second call returns the same instance (cached)."""
        import core.email as email_module

        email_module._sender = None
        with patch("django.conf.settings.EMAIL_SENDER", "stdout"):
            first = get_email_sender()
            second = get_email_sender()
        self.assertIs(first, second)

    def test_get_email_sender_unknown_backend_falls_back_to_stdout(self):
        """Unknown EMAIL_SENDER value returns StdoutAdapter so missing env does not break the app."""
        import core.email as email_module

        email_module._sender = None
        with patch("django.conf.settings.EMAIL_SENDER", "sendgrid"):
            sender = get_email_sender()
        self.assertIsInstance(sender, StdoutAdapter)
        with self.assertLogs("core.email.adapters.stdout_adapter", level=logging.INFO):
            sender.send_email(to="u@ex.com", subject="S", body_plain="P")
