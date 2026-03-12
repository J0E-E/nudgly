"""
Auth serializers: validation for register, login, password reset.
Password strength and email/username uniqueness enforced here.
"""

import re

from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()

# Username: alphanumeric and underscore; 3–30 chars for @userName display.
USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9_]{3,30}$")


# Password: min 8 chars, at least one letter and one number (basic strength).
def validate_password_strength(value: str) -> None:
    if len(value) < 8:
        raise serializers.ValidationError("Password must be at least 8 characters.")
    if not re.search(r"[a-zA-Z]", value):
        raise serializers.ValidationError("Password must contain at least one letter.")
    if not re.search(r"\d", value):
        raise serializers.ValidationError("Password must contain at least one number.")


class RegisterSerializer(serializers.Serializer):
    """Validate and create user: email, username, password."""

    email = serializers.EmailField(write_only=True, max_length=254)
    username = serializers.CharField(write_only=True, max_length=150)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_username(self, value):
        value = value.strip()
        if not USERNAME_REGEX.match(value):
            raise serializers.ValidationError(
                "Username must be 3–30 characters, letters, numbers, and underscores only."
            )
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_password(self, value):
        validate_password_strength(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            username=validated_data["username"],
            password=validated_data["password"],
        )


class LoginSerializer(serializers.Serializer):
    """Email and password for login; used to authenticate and issue JWT."""

    email = serializers.EmailField(write_only=True, max_length=254)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})


class PasswordResetRequestSerializer(serializers.Serializer):
    """Email only; no user enumeration in response."""

    email = serializers.EmailField(write_only=True, max_length=254)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Token and new password to complete reset."""

    token = serializers.CharField(write_only=True)
    new_password = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )

    def validate_new_password(self, value):
        validate_password_strength(value)
        return value
