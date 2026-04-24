# Meal Tracker Backend

Django + DRF + Postgres backend for the meal tracker SaaS.

## Stack

- Python 3.14
- Django 6.x
- Django REST Framework
- PostgreSQL
- Poetry (dependency management)

## Production notes

- Generate a strong `DJANGO_SECRET_KEY`:
  `python -c "import secrets; print(secrets.token_urlsafe(64))"`
- Optionally set a separate `JWT_SIGNING_KEY` so JWTs can be rotated independently.
- Create a **non-privileged** Postgres role for the app (don't use the `postgres` superuser):
  ```sql
  CREATE ROLE meal_tracker_app WITH LOGIN PASSWORD '...';
  GRANT CONNECT ON DATABASE meal_tracker TO meal_tracker_app;
  GRANT USAGE ON SCHEMA public TO meal_tracker_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO meal_tracker_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO meal_tracker_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO meal_tracker_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO meal_tracker_app;
  ```
  (Run migrations with a privileged role that owns the schema; runtime uses `meal_tracker_app`.)
- Axes brute-force protection is on by default (5 failures → 1h lockout per IP+email).
  Disable in tests with `AXES_ENABLED=False`.

## Setup (Docker — recommended for dev)

1. Copy env file:
   ```bash
   cp .env.example .env
   ```

2. Build and start:
   ```bash
   docker compose up --build
   ```

3. In another shell, run migrations and create a superuser:
   ```bash
   docker compose exec web python manage.py migrate
   docker compose exec web python manage.py createsuperuser
   ```

The API is now at `http://localhost:8000/`.

## Setup (local, without Docker)

1. Install dependencies:
   ```bash
   poetry install
   ```

2. Copy env file and edit:
   ```bash
   cp .env.example .env
   ```

3. Create the Postgres database:
   ```bash
   createdb meal_tracker
   ```

4. Run migrations and start the dev server:
   ```bash
   poetry run python manage.py migrate
   poetry run python manage.py createsuperuser
   poetry run python manage.py runserver
   ```

## Tests

Run the full suite inside the container:

```bash
docker compose exec web pytest
```

With coverage:

```bash
docker compose exec web pytest --cov=api --cov-report=term-missing
```

Or via Make: `make test` / `make test-cov`.

## Endpoints

- `GET /api/v1/health/` — health check
- `POST /api/v1/auth/register/` — create account (returns JWT pair)
- `POST /api/v1/auth/login/` — email + password → JWT pair
- `POST /api/v1/auth/refresh/` — rotate access token
- `POST /api/v1/auth/logout/` — blacklist a refresh token
- `POST /api/v1/auth/logout-all/` — blacklist all of a user's refresh tokens
- `GET/PATCH/DELETE /api/v1/auth/me/` — read/update/delete own account
- `POST /api/v1/auth/password/change/` — change own password
- `POST /api/v1/auth/password/reset/` — request reset email
- `GET  /api/v1/auth/password/reset/form/?token=...` — reset form page
- `POST /api/v1/auth/password/reset/confirm/` — submit new password + token
- `GET  /api/v1/auth/verify-email/?token=...` — verify email via link
- `POST /api/v1/auth/verify-email/resend/` — resend verification email
- `/admin/` — Django admin
