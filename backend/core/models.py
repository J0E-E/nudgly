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


class RecurringChoice(models.TextChoices):
    DAILY = "daily", "Daily"
    WEEKLY = "weekly", "Weekly"
    MONTHLY = "monthly", "Monthly"
    YEARLY = "yearly", "Yearly"


class HabitFrequency(models.TextChoices):
    DAILY = "daily", "Daily"
    WEEKLY = "weekly", "Weekly"
    MONTHLY = "monthly", "Monthly"


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


class List(models.Model):
    """List model per schema §8. Groups tasks; delete nullifies task.list_id."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="lists")
    name = models.CharField(max_length=200)
    category = models.CharField(
        max_length=30, choices=TaskCategory.choices, blank=True, default=""
    )
    tag = models.CharField(max_length=255, blank=True, default="")
    priority = models.IntegerField(
        choices=TaskPriority.choices, default=TaskPriority.NO_ONE_CARES
    )
    sort_order = models.IntegerField(default=0)
    muted_until = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "sort_order"])]
        ordering = ["sort_order", "created_at"]

    def __str__(self):
        return self.name[:50]


class Task(models.Model):
    """
    Task model per schema §8.
    Categories and priorities from app-idea §3–§4.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, default="")
    due_date = models.DateField(null=True, blank=True)
    due_time = models.TimeField(null=True, blank=True)
    category = models.CharField(max_length=30, choices=TaskCategory.choices)
    tag = models.CharField(max_length=255, blank=True, default="")
    priority = models.IntegerField(
        choices=TaskPriority.choices, default=TaskPriority.NO_ONE_CARES
    )
    recurring = models.CharField(
        max_length=10, choices=RecurringChoice.choices, null=True, blank=True
    )
    stack_count = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=20, choices=TaskStatus.choices, default=TaskStatus.PENDING
    )
    list = models.ForeignKey(
        "List", on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks"
    )
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


class Habit(models.Model):
    """Habit with target frequency, reminder times, and streak tracking."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="habits")
    name = models.CharField(max_length=200)
    frequency = models.CharField(max_length=10, choices=HabitFrequency.choices)
    target_count = models.PositiveIntegerField(default=1)
    reminder_times = models.JSONField(default=list, blank=True)
    streak_count = models.PositiveIntegerField(default=0)
    last_completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user"])]

    def __str__(self):
        return self.name[:50]


class HabitCompletion(models.Model):
    """Record of a habit completion or skip."""

    habit = models.ForeignKey(
        Habit, on_delete=models.CASCADE, related_name="completions"
    )
    completed_at = models.DateTimeField(auto_now_add=True)
    skipped = models.BooleanField(default=False)

    class Meta:
        indexes = [models.Index(fields=["habit", "completed_at"])]
        ordering = ["-completed_at"]

    def __str__(self):
        return f"HabitCompletion(habit={self.habit_id}, skipped={self.skipped})"


class ReminderSchedule(models.Model):
    """
    Nudge schedule per schema §8.
    Links to a task, habit, or list (exactly one via XOR constraint).
    The worker queries next_trigger_at to find due reminders.
    """

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="reminder_schedules"
    )
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="reminder_schedules",
    )
    habit = models.ForeignKey(
        Habit,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="reminder_schedules",
    )
    list = models.ForeignKey(
        "List",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="reminder_schedules",
    )
    recurrence_rule = models.TextField(blank=True, default="")
    next_trigger_at = models.DateTimeField()
    retry_interval_minutes = models.PositiveIntegerField()
    persistent = models.BooleanField(default=True)
    max_attempts = models.PositiveIntegerField()
    attempt_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["next_trigger_at", "is_active"]),
            models.Index(fields=["user"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(
                        task__isnull=False,
                        habit__isnull=True,
                        list__isnull=True,
                    )
                    | models.Q(
                        task__isnull=True,
                        habit__isnull=False,
                        list__isnull=True,
                    )
                    | models.Q(
                        task__isnull=True,
                        habit__isnull=True,
                        list__isnull=False,
                    )
                ),
                name="reminder_schedule_task_xor_habit_xor_list",
            ),
        ]

    def __str__(self):
        if self.task_id:
            target = f"task={self.task_id}"
        elif self.habit_id:
            target = f"habit={self.habit_id}"
        else:
            target = f"list={self.list_id}"
        return f"ReminderSchedule({target}, next={self.next_trigger_at})"


class ReminderEvent(models.Model):
    """
    Immutable record of a nudge firing. Idempotency enforced via unique
    constraint on (schedule, triggered_at_bucket).
    """

    schedule = models.ForeignKey(
        ReminderSchedule, on_delete=models.CASCADE, related_name="events"
    )
    triggered_at = models.DateTimeField()
    triggered_at_bucket = models.DateTimeField()
    attempt_number = models.PositiveIntegerField()
    acknowledged = models.BooleanField(default=False)
    notification_sent = models.BooleanField(default=False)
    title = models.CharField(max_length=200, blank=True, default="")
    body = models.TextField(blank=True, default="")
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["schedule", "triggered_at_bucket"],
                name="unique_schedule_trigger_bucket",
            ),
        ]

    def __str__(self):
        return (
            f"ReminderEvent(schedule={self.schedule_id}, "
            f"attempt={self.attempt_number})"
        )


class InvitationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    DECLINED = "declined", "Declined"


class Friendship(models.Model):
    """
    Symmetric friendship. Normalized so user.pk < friend.pk to avoid duplicates.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="friendships")
    friend = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="reverse_friendships"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "friend"], name="unique_friendship"
            ),
        ]
        indexes = [models.Index(fields=["user"]), models.Index(fields=["friend"])]

    def __str__(self):
        return f"Friendship({self.user_id}, {self.friend_id})"


class FriendInvitation(models.Model):
    """
    Friend invitation. Supports invite-by-username (to_user set) and
    invite-by-email to non-users (to_email set, to_user null until they register).
    """

    from_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="sent_invitations"
    )
    to_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="received_invitations",
    )
    to_email = models.EmailField(max_length=254, blank=True, default="")
    status = models.CharField(
        max_length=10,
        choices=InvitationStatus.choices,
        default=InvitationStatus.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["from_user", "to_user"],
                condition=models.Q(to_user__isnull=False, status="pending"),
                name="one_pending_invite_per_user_pair",
            ),
            models.UniqueConstraint(
                fields=["from_user", "to_email"],
                condition=models.Q(to_email__gt="", status="pending"),
                name="one_pending_invite_per_email",
            ),
        ]
        indexes = [
            models.Index(fields=["to_user", "status"]),
            models.Index(fields=["to_email"]),
        ]

    def __str__(self):
        target = self.to_user_id or self.to_email
        return f"FriendInvitation({self.from_user_id} -> {target}, {self.status})"


class DevicePlatform(models.TextChoices):
    IOS = "ios", "iOS"
    ANDROID = "android", "Android"
    WEB = "web", "Web"


class DeviceToken(models.Model):
    """
    Push notification device token per Epic 8c.
    Each device registers a token; FCM uses it for delivery.
    """

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="device_tokens"
    )
    token = models.CharField(max_length=500, unique=True)
    platform = models.CharField(max_length=10, choices=DevicePlatform.choices)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["user", "is_active"])]

    def __str__(self):
        return f"DeviceToken(user={self.user_id}, platform={self.platform})"
