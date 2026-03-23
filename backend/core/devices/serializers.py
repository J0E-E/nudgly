"""Serializers for device token registration."""

from rest_framework import serializers

from core.models import DevicePlatform


class DeviceRegisterSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=500)
    platform = serializers.ChoiceField(choices=DevicePlatform.choices)
