# Backend documentation (Nudgly API)

Django REST API with django-environ for configuration. PostgreSQL and Redis (Docker Compose). Health and email modules implemented.

## Project structure

- **config/** — Django project settings and URL root. `config/settings.py` reads `.env` from repo root.
- **core/** — Main app: health endpoint, email interface and adapters.
  - **core/views.py** — Health/readiness view (`GET /health/`).
  - **core/email/** — Email sending: interface, adapters, and `get_email_sender()`.
    - **core/email/interface.py** — `EmailSender` protocol (contract).
    - **core/email/adapters/** — Concrete implementations (e.g. `StdoutAdapter`).
- **core/tests/** — Unit tests for core (health, email).

## Running and testing

- **Run API:** From repo root, `docker compose up` (app on port 9000; nginx proxies to Django). Or run Django directly: `cd backend && python manage.py runserver`.
- **Tests:** `cd backend && python manage.py test` (uses SQLite in-memory; no Postgres required).
- **Config:** Copy `.env.example` to `.env` and set variables. See `.env.example` for required keys.

## Email

The app sends email (e.g. password reset, notifications) through an **email-sender interface**. Callers never depend on a concrete mailer; they use the interface so adapters can be swapped via configuration.

### Contract: `EmailSender`

Defined in `core.email.interface` (typing.Protocol). Implementations must provide:

- **`send_email(to, subject, body_plain, body_html=None, reply_to=None) -> None`**
  - `to`: single email string or list of email strings.
  - `subject`: subject line.
  - `body_plain`: plain-text body (required).
  - `body_html`: optional HTML body.
  - `reply_to`: optional reply-to address.
  - Implementations may raise on invalid input or delivery failure; callers should handle exceptions.

### How to send email in the app

Use the shared getter; do not instantiate adapters directly:

```python
from core.email import get_email_sender

sender = get_email_sender()
sender.send_email(to="user@example.com", subject="Subject", body_plain="Hello.")
```

### Configuration

- **Setting:** `EMAIL_SENDER` (from env, default `"stdout"`). Set in Django via `config/settings.py` / `.env`.
- **Default:** `"stdout"` — uses `StdoutAdapter`, which logs the email payload (no SMTP or third-party API). For development and testing only.

### How to add a new adapter (e.g. SendGrid)

1. **Implement the protocol** — In `core/email/adapters/`, add a new module (e.g. `sendgrid_adapter.py`) with a class that has a method `send_email(self, to, subject, body_plain, body_html=None, reply_to=None) -> None` with the same signature as the protocol.
2. **Register in the getter** — In `core/email/__init__.py`, in `get_email_sender()`, branch on `settings.EMAIL_SENDER`: e.g. if `backend == "sendgrid"`, instantiate and return your SendGrid adapter (using env/settings for API keys).
3. **Config** — Set `EMAIL_SENDER=sendgrid` (and any provider-specific env vars) in `.env` or deployment config. Call sites do not change; they still call `get_email_sender().send_email(...)`.
