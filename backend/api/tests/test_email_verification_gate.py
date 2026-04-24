"""The IsEmailVerified gate: unverified users get 403 on every domain endpoint.

Auth endpoints (/auth/*, verify-email, password reset) must remain accessible.
"""
import pytest
from rest_framework.test import APIClient


@pytest.fixture
def unverified_client(api_client, unverified_user):
    api_client.force_authenticate(user=unverified_user)
    return api_client


# Paths that MUST stay accessible for unverified users.
OPEN_TO_UNVERIFIED = [
    ("get", "/api/v1/auth/me/"),
    ("get", "/api/v1/today/"),  # today is gated but helpful to confirm — actually it IS gated
]


GATED_PATHS = [
    ("get", "/api/v1/foods/"),
    ("get", "/api/v1/recipes/"),
    ("get", "/api/v1/recipe-ingredients/"),
    ("get", "/api/v1/days/"),
    ("get", "/api/v1/meals/"),
    ("get", "/api/v1/sleep-logs/"),
    ("get", "/api/v1/nap-logs/"),
    ("get", "/api/v1/exercise-logs/"),
    ("get", "/api/v1/weight-goals/"),
    ("get", "/api/v1/targets/"),
    ("get", "/api/v1/today/"),
    ("get", "/api/v1/months/2026-4/summary/"),
]


@pytest.mark.django_db
@pytest.mark.parametrize("method,path", GATED_PATHS)
def test_unverified_user_blocked_from_domain_endpoints(
    unverified_client, method, path
):
    resp = getattr(unverified_client, method)(path)
    assert resp.status_code == 403, f"{method.upper()} {path} should return 403"


@pytest.mark.django_db
def test_unverified_user_can_read_own_profile(unverified_client):
    resp = unverified_client.get("/api/v1/auth/me/")
    assert resp.status_code == 200
    assert resp.json()["is_email_verified"] is False


@pytest.mark.django_db
def test_unverified_user_can_request_resend(unverified_client):
    resp = unverified_client.post("/api/v1/auth/verify-email/resend/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_unverified_user_can_change_password(unverified_client, user_password):
    resp = unverified_client.post(
        "/api/v1/auth/password/change/",
        {"old_password": user_password, "new_password": "NewStrongPass!999"},
        format="json",
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_unverified_user_cannot_create_food(unverified_client):
    resp = unverified_client.post(
        "/api/v1/foods/",
        {"name": "Banana", "calories": 89},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_verified_user_has_full_access(auth_client):
    assert auth_client.get("/api/v1/foods/").status_code == 200
    assert auth_client.get("/api/v1/targets/").status_code == 200
    assert auth_client.get("/api/v1/today/").status_code == 200
