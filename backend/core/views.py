"""
Health/readiness endpoint.
Returns status for API, database, and Redis. Used for k8s/Docker readiness probes.
Response: 200 when all ok; 503 when any dependency is down.
"""

import logging

import redis
from django.conf import settings
from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)

STATUS_OK = "ok"
STATUS_ERROR = "error"


def health_view(request):
    """
    GET /health/
    Returns JSON: { "status": "ok"|"error", "database": "ok"|"error", "redis": "ok"|"error" }.
    HTTP 200 if all ok; 503 if database or redis is unavailable.
    """
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    db_ok = _check_database()
    redis_ok = _check_redis()

    payload = {
        "status": STATUS_OK if (db_ok and redis_ok) else STATUS_ERROR,
        "database": STATUS_OK if db_ok else STATUS_ERROR,
        "redis": STATUS_OK if redis_ok else STATUS_ERROR,
    }

    status_code = 200 if (db_ok and redis_ok) else 503
    return JsonResponse(payload, status=status_code)


def _check_database():
    """Run a trivial DB query; return True if successful."""
    try:
        connection.ensure_connection()
        return True
    except Exception as e:
        logger.warning("Health check database error: %s", e)
        return False


def _check_redis():
    """Ping Redis; return True if successful."""
    try:
        redis_url = getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
        client = redis.from_url(redis_url)
        client.ping()
        return True
    except Exception as e:
        logger.warning("Health check redis error: %s", e)
        return False
