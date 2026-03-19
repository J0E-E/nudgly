"""
Profile serializers: PATCH /users/me (timezone, display_name; profile completion: password, username).
Reuses auth validation for password strength and username format/uniqueness.
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from core.auth.serializers import USERNAME_REGEX, validate_password_strength

User = get_user_model()


def _validate_timezone(value: str) -> str:
    """Validate timezone: non-empty, max 63 chars (IANA)."""
    if not value or not value.strip():
        raise serializers.ValidationError("Timezone cannot be empty.")
    if len(value) > 63:
        raise serializers.ValidationError("Timezone too long.")
    return value.strip()


class ProfilePatchSerializer(serializers.Serializer):
    """
    PATCH /users/me: optional timezone, display_name.
    When user needs_profile_completion (no usable password), requires password and username.
    """

    timezone = serializers.CharField(required=False, allow_blank=False, max_length=63)
    display_name = serializers.CharField(
        required=False, allow_blank=True, max_length=150
    )
    # Profile completion (only valid when user has no usable password)
    password = serializers.CharField(
        required=False, write_only=True, style={"input_type": "password"}
    )
    username = serializers.CharField(required=False, max_length=150)

    def __init__(self, instance=None, data=None, **kwargs):
        self._user = instance  # User instance
        super().__init__(instance=instance, data=data, **kwargs)

    def validate_timezone(self, value):
        return _validate_timezone(value)

    def validate_display_name(self, value):
        return (value or "").strip()[:150]

    def validate_username(self, value):
        value = (value or "").strip()
        if not USERNAME_REGEX.match(value):
            raise serializers.ValidationError(
                "Username must be 3–30 characters, letters, numbers, and underscores only."
            )
        if self._user and value.lower() != self._user.username.lower():
            if User.objects.filter(username__iexact=value).exists():
                raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_password(self, value):
        validate_password_strength(value)
        return value

    def validate(self, attrs):
        user = self._user
        needs_completion = user and not user.has_usable_password()

        if needs_completion:
            password = attrs.get("password")
            username = attrs.get("username")
            if not password or (isinstance(password, str) and not password.strip()):
                raise serializers.ValidationError(
                    {"password": "Password is required to complete your profile."}
                )
            if username is None or (isinstance(username, str) and not str(username).strip()):
                raise serializers.ValidationError(
                    {"username": "Username is required to complete your profile."}
                )
        else:
            if "password" in attrs:
                raise serializers.ValidationError(
                    {"password": "Cannot set password here; use change-password flow."}
                )
            if "username" in attrs:
                raise serializers.ValidationError(
                    {"username": "Cannot change username here."}
                )

        return attrs

    def update(self, instance, validated_data):
        user = instance
        if "timezone" in validated_data:
            user.timezone = validated_data["timezone"]
        if "display_name" in validated_data:
            user.display_name = validated_data["display_name"]
        if "password" in validated_data:
            user.set_password(validated_data["password"])
        if "username" in validated_data:
            user.username = validated_data["username"]

        update_fields = ["timezone", "display_name"]
        if "password" in validated_data:
            update_fields.append("password")
        if "username" in validated_data:
            update_fields.append("username")
        user.save(update_fields=update_fields)
        return user
