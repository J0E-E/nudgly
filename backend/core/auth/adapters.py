"""
Allauth adapters: random username for new OAuth users; JWT redirect after social login.
"""

import secrets

from django.conf import settings
from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

from core.models import User


def _random_username():
    """Generate a unique placeholder username (e.g. user_abc12def3)."""
    for _ in range(10):
        candidate = "user_" + secrets.token_hex(8)
        if not User.objects.filter(username=candidate).exists():
            return candidate
    # Fallback: try longer hex to reduce collision chance.
    for _ in range(5):
        candidate = "user_" + secrets.token_hex(12)
        if not User.objects.filter(username=candidate).exists():
            return candidate
    # Last resort; collision is astronomically unlikely after 15 attempts.
    return "user_" + secrets.token_hex(16)


class NudglyAccountAdapter(DefaultAccountAdapter):
    """
    Account adapter for email/signup flows.
    Used so ACCOUNT_ADAPTER is set; login redirect for OAuth is handled by LOGIN_REDIRECT_URL.
    """


class NudglySocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Social account adapter: set random placeholder username for new OAuth users.
    """

    def populate_user(self, request, sociallogin, data):
        """
        Populate user from provider data. Set random placeholder username if missing (our User requires it).
        """
        if not data.get("username") or not str(data.get("username", "")).strip():
            data["username"] = _random_username()
        return super().populate_user(request, sociallogin, data)
