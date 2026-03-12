"""
Auth views: register, login, logout, password reset request/confirm.
JWT via simplejwt; logout blacklists refresh token.
"""

from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenBlacklistView

from core.auth.password_reset_service import (
    consume_reset_token,
    create_reset_token_for_user,
    send_reset_email,
)
from core.auth.serializers import (
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
)

User = get_user_model()


def _user_payload(user):
    """Minimal user payload for login/register responses."""
    return {
        "id": user.pk,
        "email": user.email,
        "username": user.username,
        "timezone": user.timezone,
    }


def _tokens_for_user(user):
    """Return access and refresh token strings for user."""
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


class RegisterView(APIView):
    """POST /api/auth/register — create user, return JWT + user payload."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        tokens = _tokens_for_user(user)
        return Response(
            {"user": _user_payload(user), **tokens},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """POST /api/auth/login — email + password; return JWT + user payload."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        password = serializer.validated_data["password"]
        user = authenticate(request, username=email, password=password)
        if user is None:
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        tokens = _tokens_for_user(user)
        return Response({"user": _user_payload(user), **tokens})


class LogoutView(TokenBlacklistView):
    """POST /api/auth/logout — body: { \"refresh\": \"...\" }; blacklist refresh token."""

    permission_classes = [AllowAny]


class PasswordResetRequestView(APIView):
    """POST /api/auth/password-reset/ — send reset email if user exists; no user enumeration."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            pass
        else:
            raw_token = create_reset_token_for_user(user)
            send_reset_email(user.email, raw_token)
        return Response(status=status.HTTP_202_ACCEPTED)


class PasswordResetConfirmView(APIView):
    """POST /api/auth/password-reset/confirm/ — token + new_password; set password and invalidate token."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = consume_reset_token(serializer.validated_data["token"])
        if user is None:
            return Response(
                {"detail": "Invalid or expired reset token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """GET /api/auth/me — current user from JWT (for session restore)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_user_payload(request.user))
