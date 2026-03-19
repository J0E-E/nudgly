"""
Profile API: GET and PATCH /api/users/me/.
Uses shared user payload from auth for consistency with auth/me.
"""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.auth.views import _user_payload
from core.profile.serializers import ProfilePatchSerializer


class ProfileMeView(APIView):
    """
    GET /api/users/me/ — return current user (same shape as auth/me).
    PATCH /api/users/me/ — update timezone, display_name; or complete profile (password + username).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Return current user payload including needs_profile_completion."""
        return Response(_user_payload(request.user))

    def patch(self, request):
        """Partial update: timezone, display_name; or profile completion (password + username)."""
        serializer = ProfilePatchSerializer(
            instance=request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(_user_payload(user), status=status.HTTP_200_OK)
