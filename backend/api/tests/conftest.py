import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from api.models import User


def error_fields(resp):
    """Return the set of field names in a flattened error envelope response."""
    return {e.get("field") for e in resp.json().get("errors", [])}


def error_codes(resp):
    return {e.get("code") for e in resp.json().get("errors", [])}


def error_messages(resp):
    return [e.get("message") for e in resp.json().get("errors", [])]


@pytest.fixture(autouse=True)
def _test_settings(settings):
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_CLASSES": [],
        "DEFAULT_THROTTLE_RATES": {
            "anon": None,
            "user": None,
            "register": None,
            "login": None,
            "password_reset": None,
            "email_verify_resend": None,
            "chat": None,
        },
    }
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.AXES_ENABLED = False


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_password():
    return "TestPass!123"


@pytest.fixture
def user(db, user_password):
    return User.objects.create_user(
        email="alice@example.com",
        password=user_password,
        is_email_verified=True,
    )


@pytest.fixture
def unverified_user(db, user_password):
    return User.objects.create_user(
        email="bob@example.com",
        password=user_password,
        is_email_verified=False,
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client
