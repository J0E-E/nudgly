"""
Celery task for updating stack_count on recurring tasks.

Runs every 15 minutes via Beat. Recomputes stack_count idempotently
for all pending recurring tasks.
"""

import logging

from celery import shared_task

from core.models import TaskStatus
from core.recurrence import compute_stack_count

logger = logging.getLogger(__name__)

BATCH_SIZE = 500


@shared_task(name="core.stacking.update_stack_counts")
def update_stack_counts():
    """Recompute stack_count for all pending recurring tasks."""
    from core.models import Task

    tasks = (
        Task.objects.filter(
            status=TaskStatus.PENDING,
            recurring__isnull=False,
            due_date__isnull=False,
        )
        .select_related("user")
        .iterator()
    )

    to_update = []
    for task in tasks:
        new_count = compute_stack_count(
            task.due_date, task.due_time, task.recurring, task.user.timezone
        )
        if new_count != task.stack_count:
            task.stack_count = new_count
            to_update.append(task)

    updated = 0
    for i in range(0, len(to_update), BATCH_SIZE):
        batch = to_update[i : i + BATCH_SIZE]
        Task.objects.bulk_update(batch, ["stack_count"])
        updated += len(batch)

    logger.info("update_stack_counts: updated=%d", updated)
