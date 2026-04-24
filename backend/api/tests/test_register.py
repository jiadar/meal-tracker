import pytest
from django.core import mail

from api.models import User, UserProfile
from api.tests.conftest import error_fields


@pytest.mark.django_db
def test_register_success_creates_user_and_profile_and_returns_tokens(api_client):
    resp = api_client.post(
        "/api/v1/auth/register/",
        {
            "email": "new@example.com",
            "password": "StrongPass!123",
            "display_name": "New User",
        },
        format="json",
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["user"]["email"] == "new@example.com"
    assert body["user"]["is_email_verified"] is False
    assert body["user"]["profile"]["display_name"] == "New User"
    assert "access" in body["tokens"]
    assert "refresh" in body["tokens"]

    user = User.objects.get(email="new@example.com")
    assert user.profile is not None
    assert UserProfile.objects.filter(user=user).count() == 1
    assert user.profile.bmr == 1970


@pytest.mark.django_db
def test_register_sends_verification_email(api_client):
    api_client.post(
        "/api/v1/auth/register/",
        {"email": "mail@example.com", "password": "StrongPass!123"},
        format="json",
    )
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["mail@example.com"]
    assert "verify" in mail.outbox[0].subject.lower()


@pytest.mark.django_db
def test_register_duplicate_email_rejected(api_client, user):
    resp = api_client.post(
        "/api/v1/auth/register/",
        {"email": user.email, "password": "StrongPass!123"},
        format="json",
    )
    assert resp.status_code == 400
    assert "email" in error_fields(resp)


@pytest.mark.django_db
def test_register_duplicate_email_case_insensitive(api_client, user):
    resp = api_client.post(
        "/api/v1/auth/register/",
        {"email": user.email.upper(), "password": "StrongPass!123"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_register_weak_password_rejected(api_client):
    resp = api_client.post(
        "/api/v1/auth/register/",
        {"email": "weak@example.com", "password": "123"},
        format="json",
    )
    assert resp.status_code == 400
    assert "password" in error_fields(resp)
    assert User.objects.filter(email="weak@example.com").count() == 0


@pytest.mark.django_db
def test_register_invalid_email_rejected(api_client):
    resp = api_client.post(
        "/api/v1/auth/register/",
        {"email": "not-an-email", "password": "StrongPass!123"},
        format="json",
    )
    assert resp.status_code == 400
    assert "email" in error_fields(resp)
