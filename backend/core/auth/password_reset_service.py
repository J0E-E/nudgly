"""
Password reset: create token, send email, confirm and invalidate.
Uses get_email_sender() for sending; PasswordResetToken model for one-time tokens.
"""

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from core.email import get_email_sender
from core.models import PasswordResetToken, User

# Token valid for 1 hour.
RESET_TOKEN_EXPIRY = timedelta(hours=1)


def create_reset_token_for_user(user: User) -> str:
    """
    Create a one-time reset token for the user; store hash in DB, return raw token for the link.
    Caller should send the raw token in the email link.
    """
    raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    expires_at = timezone.now() + RESET_TOKEN_EXPIRY
    PasswordResetToken.objects.create(
        user=user, token_hash=token_hash, expires_at=expires_at
    )
    return raw


def send_reset_email(to_email: str, raw_token: str) -> None:
    """Build reset link and send email via configured sender."""
    base_url = getattr(settings, "FRONTEND_ORIGIN", "http://localhost:5173").rstrip("/")
    reset_link = f"{base_url}/reset-password/confirm?token={raw_token}"
    body = (
        f"You requested a password reset for your Nudgly account.\n\n"
        f"Click the link below to set a new password (valid for 1 hour):\n{reset_link}\n\n"
        f"If you did not request this, you can ignore this email."
    )
    sender = get_email_sender()
    sender.send_email(
        to=to_email, subject="Reset your Nudgly password", body_plain=body
    )


def consume_reset_token(raw_token: str) -> User | None:
    """
    If token is valid and not expired, delete it and return the user; otherwise return None.
    """
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    try:
        prt = PasswordResetToken.objects.get(token_hash=token_hash)
    except PasswordResetToken.DoesNotExist:
        return None
    if timezone.now() > prt.expires_at:
        prt.delete()
        return None
    user = prt.user
    prt.delete()
    return user
