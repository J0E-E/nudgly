"""
Core models: custom User, PasswordResetToken, Task.
User uses email as the login identifier; username is for @userName identity (e.g. friends).
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models


class TaskCategory(models.TextChoices):
    TREAT_MYSELF = "treat_myself", "Treat Myself"
    GLOW_UP = "glow_up", "Glow-Up Agenda"
    ADULTING = "adulting", "Adulting\u2122"
    I_SAID_I_WOULD = "i_said_i_would", "I Said I Would"
    THE_INEVITABLE = "the_inevitable", "The Inevitable"


class TaskPriority(models.IntegerChoices):
    NO_ONE_CARES = 0, "No one cares"
    NO_ONE_IS_WATCHING = 1, "No one is watching"
    ILL_FEEL_GUILTY = 2, "I'll feel guilty"
    OTHERS_ARE_WATCHING = 3, "Others are watching"
    OTHERS_WILL_BE_LET_DOWN = 4, "Others will be let down"
    ILL_LET_MYSELF_DOWN = 5, "I'll let myself down"


class TaskStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


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


class Task(models.Model):
    """
    Task model per schema §8.
    Categories and priorities from app-idea §3–§4.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, default="")
    due_date = models.DateField(null=True, blank=True)
    category = models.CharField(max_length=30, choices=TaskCategory.choices)
    tag = models.CharField(max_length=255, blank=True, default="")
    priority = models.IntegerField(
        choices=TaskPriority.choices, default=TaskPriority.NO_ONE_CARES
    )
    recurring = models.TextField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=TaskStatus.choices, default=TaskStatus.PENDING
    )
    list_id = models.IntegerField(null=True, blank=True)
    muted_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_tasks",
    )
    linked_friends = models.ManyToManyField(
        User, blank=True, related_name="linked_tasks"
    )

    class Meta:
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["user", "due_date"]),
        ]

    def __str__(self):
        return self.title[:50]
