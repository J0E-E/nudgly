"""
Email-sender interface (protocol) for Nudgly.
Callers depend on this contract only; concrete adapters (stdout, SendGrid, etc.) implement it.
"""

from typing import Protocol


class EmailSender(Protocol):
    """
    Contract for sending email. All callers (e.g. password reset, notifications)
    must use this interface via get_email_sender(); do not depend on a concrete implementation.

    Implementations may raise on invalid input or delivery failure; callers should handle exceptions.
    """

    def send_email(
        self,
        to: str | list[str],
        subject: str,
        body_plain: str,
        body_html: str | None = None,
        reply_to: str | None = None,
    ) -> None:
        """
        Send an email.

        Args:
            to: Single recipient email or list of recipient emails.
            subject: Email subject line.
            body_plain: Plain-text body (required).
            body_html: Optional HTML body.
            reply_to: Optional reply-to address.

        Raises:
            Implementations may raise on invalid input or delivery failure.
        """
        ...
