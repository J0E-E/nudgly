"""Email sender adapters. StdoutAdapter is the default for dev/test; add SendGrid etc. here."""

from core.email.adapters.stdout_adapter import StdoutAdapter

__all__ = ["StdoutAdapter"]
