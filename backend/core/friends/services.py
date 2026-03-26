"""
Friend invitation and friendship business logic.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone

from core.email import get_email_sender
from core.friends.notifications import notify_friend_event
from core.models import Friendship, FriendInvitation

User = get_user_model()


def create_friendship(user_a, user_b):
    """Create a normalized Friendship row (lower pk = user, higher pk = friend)."""
    lo, hi = sorted([user_a, user_b], key=lambda u: u.pk)
    Friendship.objects.get_or_create(user=lo, friend=hi)


def remove_friendship(user_a, user_b):
    """Delete the normalized Friendship row between two users."""
    lo, hi = sorted([user_a, user_b], key=lambda u: u.pk)
    Friendship.objects.filter(user=lo, friend=hi).delete()


def are_friends(user_a, user_b):
    """Return True if users are friends."""
    lo, hi = sorted([user_a, user_b], key=lambda u: u.pk)
    return Friendship.objects.filter(user=lo, friend=hi).exists()


def get_friends(user):
    """Return queryset of User objects who are friends with the given user."""
    friend_ids = Friendship.objects.filter(
        Q(user=user) | Q(friend=user)
    ).values_list("user_id", "friend_id")
    ids = set()
    for u_id, f_id in friend_ids:
        ids.add(f_id if u_id == user.pk else u_id)
    return User.objects.filter(pk__in=ids)


def send_invite(from_user, to_username=None, to_email=None):
    """
    Send a friend invitation. Exactly one of to_username or to_email must be provided.
    Returns (invitation, error_message). On success error_message is None.
    """
    if to_username:
        try:
            to_user = User.objects.get(username__iexact=to_username)
        except User.DoesNotExist:
            return None, "User not found."
        if to_user.pk == from_user.pk:
            return None, "You cannot invite yourself."
        if are_friends(from_user, to_user):
            return None, "You are already friends."
        if FriendInvitation.objects.filter(
            from_user=from_user, to_user=to_user, status="pending"
        ).exists():
            return None, "Invitation already pending."
        invitation = FriendInvitation.objects.create(
            from_user=from_user, to_user=to_user
        )
        notify_friend_event(to_user, from_user, "friend_request_received")
        return invitation, None

    if to_email:
        email = to_email.strip().lower()
        if email == from_user.email.lower():
            return None, "You cannot invite yourself."
        # Check if the email belongs to an existing user
        try:
            to_user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            to_user = None

        if to_user:
            if are_friends(from_user, to_user):
                return None, "You are already friends."
            if FriendInvitation.objects.filter(
                from_user=from_user, to_user=to_user, status="pending"
            ).exists():
                return None, "Invitation already pending."
            invitation = FriendInvitation.objects.create(
                from_user=from_user, to_user=to_user, to_email=email
            )
            notify_friend_event(to_user, from_user, "friend_request_received")
            return invitation, None

        # Non-user: store with to_email only, send sign-up email
        if FriendInvitation.objects.filter(
            from_user=from_user, to_email=email, status="pending"
        ).exists():
            return None, "Invitation already pending."
        invitation = FriendInvitation.objects.create(
            from_user=from_user, to_email=email
        )
        _send_invite_email(from_user, email)
        return invitation, None

    return None, "Provide to_username or to_email."


def accept_invite(invitation, user):
    """Accept a pending invitation. Returns error message or None."""
    if invitation.to_user_id != user.pk:
        return "Not your invitation."
    if invitation.status != "pending":
        return "Invitation is not pending."
    invitation.status = "accepted"
    invitation.responded_at = timezone.now()
    invitation.save(update_fields=["status", "responded_at"])
    create_friendship(invitation.from_user, user)
    notify_friend_event(invitation.from_user, user, "friend_request_accepted")
    return None


def decline_invite(invitation, user):
    """Decline a pending invitation. Returns error message or None."""
    if invitation.to_user_id != user.pk:
        return "Not your invitation."
    if invitation.status != "pending":
        return "Invitation is not pending."
    invitation.status = "declined"
    invitation.responded_at = timezone.now()
    invitation.save(update_fields=["status", "responded_at"])
    notify_friend_event(invitation.from_user, user, "friend_request_declined")
    return None


def link_pending_invitations(user):
    """
    Called on registration: link email-based invitations to the new user account.
    Sets to_user on matching pending invitations so they appear in the user's inbox.
    """
    FriendInvitation.objects.filter(
        to_email__iexact=user.email, to_user__isnull=True, status="pending"
    ).update(to_user=user)


def _send_invite_email(from_user, to_email):
    """Send a sign-up invitation email to a non-user."""
    frontend_origin = getattr(settings, "FRONTEND_ORIGIN", "http://localhost:5173")
    signup_url = f"{frontend_origin}/register"
    sender = get_email_sender()
    sender.send_email(
        to=to_email,
        subject=f"{from_user.display_name or from_user.username} invited you to Nudgly!",
        body_plain=(
            f"Hi! {from_user.display_name or from_user.username} wants to be your "
            f"friend on Nudgly.\n\n"
            f"Sign up to connect: {signup_url}\n"
        ),
    )
