"""
Celery application for Nudgly.

Configures Celery to use Redis as broker, autodiscovers tasks from installed apps,
and defines the Beat schedule for periodic nudge processing.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("nudgly")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
app.conf.include = ["core.nudge", "core.devices.tasks"]
