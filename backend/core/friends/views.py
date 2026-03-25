"""
Friends & Invitations API views.
"""

from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.friends.serializers import (
    InvitationActionSerializer,
    InviteSerializer,
    friend_payload,
    invitation_payload,
)
from core.friends.services import (
    accept_invite,
    decline_invite,
    get_friends,
    remove_friendship,
    send_invite,
)
from core.models import FriendInvitation, Friendship

from django.contrib.auth import get_user_model

User = get_user_model()


class FriendListView(APIView):
    """GET /api/friends/ — list current user's friends."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        friends = get_friends(request.user)
        return Response([friend_payload(f) for f in friends])


class InviteView(APIView):
    """POST /api/friends/invite/ — send a friend invitation."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = InviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation, error = send_invite(
            from_user=request.user,
            to_username=serializer.validated_data.get("to_username"),
            to_email=serializer.validated_data.get("to_email"),
        )
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)
        return Response(invitation_payload(invitation), status=status.HTTP_201_CREATED)


class InvitationListView(APIView):
    """GET /api/friends/invitations/ — list sent/received invitations."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        direction = request.query_params.get("direction")
        status_filter = request.query_params.get("status")

        if direction == "sent":
            qs = FriendInvitation.objects.filter(from_user=request.user)
        elif direction == "received":
            qs = FriendInvitation.objects.filter(to_user=request.user)
        else:
            qs = FriendInvitation.objects.filter(
                Q(from_user=request.user) | Q(to_user=request.user)
            )

        if status_filter:
            qs = qs.filter(status=status_filter)

        qs = qs.select_related("from_user", "to_user").order_by("-created_at")
        return Response([invitation_payload(inv) for inv in qs])


class InvitationDetailView(APIView):
    """PATCH /api/friends/invitations/<id>/ — accept or decline."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            invitation = FriendInvitation.objects.select_related(
                "from_user", "to_user"
            ).get(pk=pk)
        except FriendInvitation.DoesNotExist:
            return Response(
                {"detail": "Invitation not found."}, status=status.HTTP_404_NOT_FOUND
            )

        serializer = InvitationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data["action"]

        if action == "accept":
            error = accept_invite(invitation, request.user)
        else:
            error = decline_invite(invitation, request.user)

        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)
        return Response(invitation_payload(invitation))


class FriendRemoveView(APIView):
    """DELETE /api/friends/<user_id>/ — remove a friendship."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id):
        try:
            other = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND
            )

        lo, hi = sorted([request.user.pk, other.pk])
        if not Friendship.objects.filter(user_id=lo, friend_id=hi).exists():
            return Response(
                {"detail": "Not friends."}, status=status.HTTP_400_BAD_REQUEST
            )

        remove_friendship(request.user, other)
        return Response(status=status.HTTP_204_NO_CONTENT)
