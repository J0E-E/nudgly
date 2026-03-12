"""
Stdout adapter for the email-sender interface.
Writes email payload to the logger (configurable to stdout in dev). For development and testing only.
Production should use a real provider adapter (e.g. SendGrid).
"""

import logging

logger = logging.getLogger(__name__)


class StdoutAdapter:
    """
    Implements EmailSender by logging the email payload. No SMTP or third-party API.
    Use in dev/test; swap to a real adapter in production via EMAIL_SENDER setting.
    """

    def send_email(
        self,
        to: str | list[str],
        subject: str,
        body_plain: str,
        body_html: str | None = None,
        reply_to: str | None = None,
    ) -> None:
        """Log to, subject, bodies, and reply_to as a structured human-readable message."""
        recipients = [to] if isinstance(to, str) else to
        lines = [
            "--- Email (stdout adapter) ---",
            f"To: {', '.join(recipients)}",
            f"Subject: {subject}",
            f"Reply-To: {reply_to}" if reply_to else None,
            "--- Body (plain) ---",
            body_plain,
        ]
        if body_html:
            lines.extend(["--- Body (HTML) ---", body_html])
        lines.append("---")
        message = "\n".join(line for line in lines if line is not None)
        logger.info(message)
