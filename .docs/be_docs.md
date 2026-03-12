# Backend documentation (Nudgly API)

Django REST API with django-environ for configuration. PostgreSQL and Redis (Docker Compose). Health, email, and authentication (JWT) implemented.

## Project structure

- **config/** — Django project settings and URL root. `config/settings.py` reads `.env` from repo root.
- **core/** — Main app: health, email, auth, and models.
  - **core/views.py** — Health/readiness view (`GET /health/`).
  - **core/models.py** — Custom `User` (email as identifier, username for @userName) and `PasswordResetToken`.
  - **core/email/** — Email sending: interface, adapters, and `get_email_sender()`.
    - **core/email/interface.py** — `EmailSender` protocol (contract).
    - **core/email/adapters/** — Concrete implementations (e.g. `StdoutAdapter`).
  - **core/auth/** — Auth API: register, login, logout, password reset, me, token refresh.
    - **core/auth/serializers.py** — Validation for register, login, password reset.
    - **core/auth/views.py** — Register, Login, Logout (blacklist), PasswordResetRequest, PasswordResetConfirm, Me.
    - **core/auth/password_reset_service.py** — Token creation, email send, token consume.
    - **core/auth/urls.py** — Routes under `/api/auth/`.
  - **core/api_urls.py** — Mounts `auth/` under `/api/`.
- **core/tests/** — Unit tests for core (health, email, auth).

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

---

## Authentication

Auth uses a **custom User model** (`core.User`) with **email as the login identifier** and **username** for @userName identity (per app-idea §4). JWT access and refresh tokens are issued via **djangorestframework-simplejwt**; logout uses the token blacklist.

### User model

- **AUTH_USER_MODEL:** `core.User` (set in `config/settings.py`).
- **Fields:** `id`, `email` (unique, USERNAME_FIELD), `password` (Django-hashed), `username` (unique), `timezone` (IANA, default `"UTC"`), `created_at`, `is_active`.

### Auth API (under `/api/auth/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Body: `email`, `username`, `password`. Returns `user`, `access`, `refresh`. |
| POST | `/api/auth/login/` | Body: `email`, `password`. Returns `user`, `access`, `refresh`. |
| POST | `/api/auth/logout/` | Body: `refresh`. Blacklists the refresh token. |
| POST | `/api/auth/token/refresh/` | Body: `refresh`. Returns `access`. |
| GET | `/api/auth/me/` | Requires `Authorization: Bearer <access>`. Returns current user payload. |
| POST | `/api/auth/password-reset/` | Body: `email`. Sends reset email if user exists; always 202 (no enumeration). |
| POST | `/api/auth/password-reset/confirm/` | Body: `token`, `new_password`. Invalidates token and sets password. |

### JWT configuration

- **REST_FRAMEWORK:** `DEFAULT_AUTHENTICATION_CLASSES` includes `JWTAuthentication`.
- **SIMPLE_JWT** (in `settings.py`): `ACCESS_TOKEN_LIFETIME` (e.g. 60 min), `REFRESH_TOKEN_LIFETIME` (e.g. 7 days), `BLACKLIST_AFTER_ROTATION`: True for logout.

### Password reset flow

1. Client POSTs email to `/api/auth/password-reset/`. Backend creates a `PasswordResetToken` (hash stored, raw token in link), sends email via `get_email_sender()` with link `{FRONTEND_ORIGIN}/reset-password/confirm?token=...`.
2. User opens link; client POSTs `token` and `new_password` to `/api/auth/password-reset/confirm/`. Backend validates token, sets password, deletes token.

**Config:** `FRONTEND_ORIGIN` in env (e.g. `http://localhost:5173`) for building the reset link.

### Validation

- **Password:** Min 8 characters; at least one letter and one number (in `core.auth.serializers`).
- **Email:** Format and uniqueness at register.
- **Username:** 3–30 chars, alphanumeric and underscore; uniqueness at register.

---

## Troubleshooting

### 502 Bad Gateway when calling the API (e.g. register, login)

A 502 from nginx means it could not get a valid response from the Django container. The backend may have crashed, not be running, or be failing to accept the connection.

1. **Check that the API container is up:**  
   `docker compose ps` — ensure `django_api` is running and healthy.

2. **See the real error:**  
   Reproduce the request (e.g. try to register again) while tailing Django logs:  
   `docker compose logs -f django_api`  
   Look for a Python traceback (e.g. `IntegrityError`, `OperationalError`, or unhandled exception). Fix the underlying cause (e.g. DB not ready, missing migration, bug in view/serializer).

3. **If using Docker:**  
   Ensure migrations have run (the compose command runs `migrate` before gunicorn). If the DB was recreated, run:  
   `docker compose run --rm django_api python manage.py migrate --noinput`

### InconsistentMigrationHistory (token_blacklist before core.0001_initial)

If you see:

```text
InconsistentMigrationHistory: Migration token_blacklist.0001_initial is applied before its dependency core.0001_initial on database 'default'.
```

the migration table is out of order (e.g. the DB was migrated with an older or different codebase). The simplest fix for **local development** is to reset the database so migrations run from scratch in the correct order:

1. Stop and remove containers and the Postgres volume:  
   `docker compose down -v`
2. Start again (this recreates the DB and runs migrations):  
   `docker compose up -d`

**Note:** `-v` removes named volumes (e.g. `postgres_data`), so all DB data is lost. Only do this when you can afford to lose local data. For production or when you must keep data, you would need to correct the `django_migrations` table and possibly re-run or fake migrations (advanced; back up first).
