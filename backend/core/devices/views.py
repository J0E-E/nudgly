"""Device token registration and deactivation views."""

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.devices.serializers import DeviceRegisterSerializer
from core.models import DeviceToken


class DeviceRegisterView(APIView):
    """POST /api/devices/register/ -- upsert a device token."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = DeviceRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]
        platform = serializer.validated_data["platform"]

        device, created = DeviceToken.objects.update_or_create(
            token=token,
            defaults={
                "user": request.user,
                "platform": platform,
                "is_active": True,
            },
        )
        return Response(
            {
                "token": device.token,
                "platform": device.platform,
                "is_active": device.is_active,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class DeviceDeactivateView(APIView):
    """DELETE /api/devices/{token}/ -- deactivate a device token."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, token):
        updated = DeviceToken.objects.filter(
            token=token, user=request.user, is_active=True
        ).update(is_active=False)
        if not updated:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)
