"""
Serializers and payload helpers for the friends/invitations API.
"""

from rest_framework import serializers


def friend_payload(user):
    """Serialize a user as a friend summary."""
    return {
        "id": user.pk,
        "username": user.username,
        "display_name": getattr(user, "display_name", "") or "",
        "email": user.email,
    }


def invitation_payload(invitation):
    """Serialize a FriendInvitation."""
    return {
        "id": invitation.pk,
        "from_user": friend_payload(invitation.from_user),
        "to_user": friend_payload(invitation.to_user) if invitation.to_user else None,
        "to_email": invitation.to_email,
        "status": invitation.status,
        "created_at": invitation.created_at.isoformat(),
        "responded_at": (
            invitation.responded_at.isoformat() if invitation.responded_at else None
        ),
    }


class InviteSerializer(serializers.Serializer):
    """Validate invite payload: exactly one of to_email or to_username."""

    to_email = serializers.EmailField(required=False, max_length=254)
    to_username = serializers.CharField(required=False, max_length=150)

    def validate(self, data):
        has_email = bool(data.get("to_email"))
        has_username = bool(data.get("to_username"))
        if has_email == has_username:
            raise serializers.ValidationError(
                "Provide exactly one of to_email or to_username."
            )
        return data


class InvitationActionSerializer(serializers.Serializer):
    """Validate accept/decline action."""

    action = serializers.ChoiceField(choices=["accept", "decline"])
