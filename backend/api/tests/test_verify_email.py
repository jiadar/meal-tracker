import pytest
from django.core import mail

from api.tokens import EMAIL_VERIFY_PURPOSE, PASSWORD_RESET_PURPOSE, make_token


@pytest.mark.django_db
def test_verify_email_success(api_client, unverified_user):
    token = make_token(unverified_user.pk, EMAIL_VERIFY_PURPOSE)
    resp = api_client.get(f"/api/v1/auth/verify-email/?token={token}")
    assert resp.status_code == 200
    unverified_user.refresh_from_db()
    assert unverified_user.is_email_verified is True


@pytest.mark.django_db
def test_verify_email_invalid_token(api_client):
    resp = api_client.get("/api/v1/auth/verify-email/?token=garbage")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_verify_email_wrong_purpose_token_rejected(api_client, unverified_user):
    token = make_token(unverified_user.pk, PASSWORD_RESET_PURPOSE)
    resp = api_client.get(f"/api/v1/auth/verify-email/?token={token}")
    assert resp.status_code == 400
    unverified_user.refresh_from_db()
    assert unverified_user.is_email_verified is False


@pytest.mark.django_db
def test_verify_email_idempotent_when_already_verified(api_client, user):
    token = make_token(user.pk, EMAIL_VERIFY_PURPOSE)
    resp = api_client.get(f"/api/v1/auth/verify-email/?token={token}")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.is_email_verified is True


@pytest.mark.django_db
def test_resend_verification_requires_auth(api_client):
    resp = api_client.post("/api/v1/auth/verify-email/resend/")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_resend_verification_sends_email(api_client, unverified_user):
    api_client.force_authenticate(user=unverified_user)
    mail.outbox.clear()
    resp = api_client.post("/api/v1/auth/verify-email/resend/")
    assert resp.status_code == 200
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [unverified_user.email]


@pytest.mark.django_db
def test_resend_verification_noop_when_already_verified(api_client, user):
    api_client.force_authenticate(user=user)
    mail.outbox.clear()
    resp = api_client.post("/api/v1/auth/verify-email/resend/")
    assert resp.status_code == 200
    assert len(mail.outbox) == 0
