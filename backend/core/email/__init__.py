"""
Email sending for Nudgly. Callers use get_email_sender() and the EmailSender interface only.
Adapter is chosen by EMAIL_SENDER setting (e.g. "stdout"); default is stdout.
"""

from django.conf import settings

from core.email.adapters.stdout_adapter import StdoutAdapter
from core.email.interface import EmailSender

# Cached adapter instance; built lazily on first get_email_sender() call.
_sender: EmailSender | None = None


def get_email_sender() -> EmailSender:
    """
    Return the configured email sender adapter. Reads settings.EMAIL_SENDER;
    "stdout" (default) returns StdoutAdapter. Unknown values fall back to stdout.
    Instance is cached after first call.
    """
    global _sender
    if _sender is not None:
        return _sender
    backend = getattr(settings, "EMAIL_SENDER", "stdout")
    if backend == "stdout":
        _sender = StdoutAdapter()
    else:
        # Unknown backend: default to stdout so missing env does not break the app.
        _sender = StdoutAdapter()
    return _sender


__all__ = ["EmailSender", "StdoutAdapter", "get_email_sender"]
