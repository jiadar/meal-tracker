import pytest
from django.core import mail

from api.tokens import (
    EMAIL_VERIFY_PURPOSE,
    PASSWORD_RESET_PURPOSE,
    make_token,
)


@pytest.mark.django_db
def test_password_reset_request_for_real_user_sends_email(api_client, user):
    resp = api_client.post(
        "/api/v1/auth/password/reset/", {"email": user.email}, format="json"
    )
    assert resp.status_code == 200
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [user.email]


@pytest.mark.django_db
def test_password_reset_request_for_unknown_email_returns_200_no_email(api_client):
    resp = api_client.post(
        "/api/v1/auth/password/reset/",
        {"email": "nobody@example.com"},
        format="json",
    )
    assert resp.status_code == 200
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_password_reset_confirm_with_valid_token_changes_password(api_client, user):
    token = make_token(user.pk, PASSWORD_RESET_PURPOSE)
    resp = api_client.post(
        "/api/v1/auth/password/reset/confirm/",
        {"token": token, "new_password": "ResetStrong!987"},
        format="json",
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.check_password("ResetStrong!987")


@pytest.mark.django_db
def test_password_reset_confirm_with_bad_token_rejected(api_client, user):
    original_password_hash = user.password
    resp = api_client.post(
        "/api/v1/auth/password/reset/confirm/",
        {"token": "garbage", "new_password": "ResetStrong!987"},
        format="json",
    )
    assert resp.status_code == 400
    user.refresh_from_db()
    assert user.password == original_password_hash


@pytest.mark.django_db
def test_password_reset_confirm_rejects_verify_email_token(api_client, user):
    # Token signed with the wrong purpose must not be accepted here.
    token = make_token(user.pk, EMAIL_VERIFY_PURPOSE)
    resp = api_client.post(
        "/api/v1/auth/password/reset/confirm/",
        {"token": token, "new_password": "ResetStrong!987"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_password_reset_confirm_weak_password_rejected(api_client, user):
    token = make_token(user.pk, PASSWORD_RESET_PURPOSE)
    resp = api_client.post(
        "/api/v1/auth/password/reset/confirm/",
        {"token": token, "new_password": "123"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_password_reset_form_page_renders_with_valid_token(api_client, user):
    token = make_token(user.pk, PASSWORD_RESET_PURPOSE)
    resp = api_client.get(f"/api/v1/auth/password/reset/form/?token={token}")
    assert resp.status_code == 200
    assert b"Reset Password" in resp.content
    assert b"invalid" not in resp.content.lower()


@pytest.mark.django_db
def test_password_reset_form_page_shows_error_with_bad_token(api_client):
    resp = api_client.get("/api/v1/auth/password/reset/form/?token=garbage")
    assert resp.status_code == 200
    assert b"invalid" in resp.content.lower() or b"expired" in resp.content.lower()
