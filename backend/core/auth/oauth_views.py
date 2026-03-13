"""
OAuth views: complete (JWT + redirect to frontend) and authorize redirects to provider login.
"""

from urllib.parse import urlencode

from django.conf import settings
from django.http import HttpResponseRedirect
from django.views.generic import RedirectView

from core.auth.views import _tokens_for_user


def oauth_complete_view(request):
    """
    After allauth social login: issue JWT and redirect to frontend with tokens in fragment.
    Clears session so no server-side session remains.
    """
    if not request.user.is_authenticated:
        # Redirect to frontend login with error in query (no fragment for error)
        base = settings.FRONTEND_ORIGIN.rstrip("/") + "/login"
        return HttpResponseRedirect(base + "?oauth_error=not_authenticated")

    tokens = _tokens_for_user(request.user)
    fragment = urlencode(
        {"access": tokens["access"], "refresh": tokens["refresh"]}
    )
    callback_url = (
        settings.FRONTEND_ORIGIN.rstrip("/") + "/auth/callback#" + fragment
    )

    request.session.flush()
    return HttpResponseRedirect(callback_url)


class OAuthAuthorizeRedirectView(RedirectView):
    """Redirect to allauth's provider login (e.g. /api/auth/oauth/<provider>/login/)."""

    permanent = False
    provider = None  # subclasses set "google" or "apple"

    def get_redirect_url(self, *args, **kwargs):
        # Use FRONTEND_ORIGIN so redirect/callback use the same host the user sees (e.g. localhost:9000 behind nginx).
        base = settings.FRONTEND_ORIGIN.rstrip("/") + "/api/auth/oauth"
        # Allauth social login is at /oauth/<provider>/login/ (google_login, apple_login in URLconf).
        return f"{base}/{self.provider}/login/"


class GoogleAuthorizeView(OAuthAuthorizeRedirectView):
    """Redirect to Google OAuth login."""

    provider = "google"


class AppleAuthorizeView(OAuthAuthorizeRedirectView):
    """Redirect to Apple OAuth login."""

    provider = "apple"
