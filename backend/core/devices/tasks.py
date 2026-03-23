"""Celery tasks for device token maintenance."""

from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from core.models import DeviceToken


@shared_task(name="core.devices.tasks.purge_stale_device_tokens")
def purge_stale_device_tokens():
    """Delete device tokens that have been inactive for more than 30 days."""
    cutoff = timezone.now() - timedelta(days=30)
    deleted, _ = DeviceToken.objects.filter(
        is_active=False, updated_at__lte=cutoff
    ).delete()
    return deleted
