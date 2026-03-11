# Nudgly API: Django + Gunicorn.
# Build from repo root: docker build -f backend/Dockerfile .
FROM python:3.12-slim

# Create app user and dir
RUN adduser --disabled-password --gecos "" appuser
WORKDIR /app

# Install dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ /app/

# Run as non-root
USER appuser

# Gunicorn bound to all interfaces for Docker
EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "1", "config.wsgi:application"]
