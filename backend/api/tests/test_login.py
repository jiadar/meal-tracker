import pytest


@pytest.mark.django_db
def test_login_success_returns_tokens_and_user(api_client, user, user_password):
    resp = api_client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": user_password},
        format="json",
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access" in body
    assert "refresh" in body
    assert body["user"]["email"] == user.email
    assert body["user"]["is_email_verified"] is True


@pytest.mark.django_db
def test_login_wrong_password_rejected(api_client, user):
    resp = api_client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": "wrong-password"},
        format="json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_login_unknown_email_rejected(api_client):
    resp = api_client.post(
        "/api/v1/auth/login/",
        {"email": "nobody@example.com", "password": "anything"},
        format="json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_login_unverified_user_can_still_login(api_client, unverified_user, user_password):
    resp = api_client.post(
        "/api/v1/auth/login/",
        {"email": unverified_user.email, "password": user_password},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["is_email_verified"] is False


@pytest.mark.django_db
def test_refresh_returns_new_access_token(api_client, user, user_password):
    login = api_client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": user_password},
        format="json",
    ).json()
    resp = api_client.post(
        "/api/v1/auth/refresh/", {"refresh": login["refresh"]}, format="json"
    )
    assert resp.status_code == 200
    assert "access" in resp.json()
