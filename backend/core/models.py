"""
Core models: custom User and PasswordResetToken.
User uses email as the login identifier; username is for @userName identity (e.g. friends).
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """Custom manager for User with email as identifier."""

    def create_user(
        self, email, username, timezone="UTC", password=None, **extra_fields
    ):
        """Create and save a user with email, username, and hashed password."""
        if not email:
            raise ValueError("Users must have an email address.")
        if not username:
            raise ValueError("Users must have a username.")
        email = self.normalize_email(email)
        user = self.model(
            email=email, username=username, timezone=timezone, **extra_fields
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(
        self, email, username, timezone="UTC", password=None, **extra_fields
    ):
        """Create and save a superuser; is_staff and is_superuser not used in MVP but required by AbstractBaseUser contract."""
        extra_fields.setdefault("is_active", True)
        return self.create_user(
            email=email,
            username=username,
            timezone=timezone,
            password=password,
            **extra_fields,
        )


class User(AbstractBaseUser):
    """
    Custom user model: email as login, username for @userName identity.
    Schema §8: id, email, password_hash (Django stores hashed), timezone, created_at; username per app-idea §4.
    """

    email = models.EmailField(unique=True, max_length=254)
    username = models.CharField(max_length=150, unique=True)
    timezone = models.CharField(max_length=63, default="UTC")
    display_name = models.CharField(max_length=150, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return self.email


class PasswordResetToken(models.Model):
    """
    One-time token for password reset. Stored hash only; raw token sent in email link.
    Invalidated on use or expiry.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [models.Index(fields=["token_hash"])]
