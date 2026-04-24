import pytest
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken


def _login(api_client, email, password):
    return api_client.post(
        "/api/v1/auth/login/",
        {"email": email, "password": password},
        format="json",
    ).json()


@pytest.mark.django_db
def test_logout_blacklists_refresh_token(api_client, user, user_password):
    tokens = _login(api_client, user.email, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    resp = api_client.post(
        "/api/v1/auth/logout/", {"refresh": tokens["refresh"]}, format="json"
    )
    assert resp.status_code == 205
    refresh = api_client.post(
        "/api/v1/auth/refresh/", {"refresh": tokens["refresh"]}, format="json"
    )
    assert refresh.status_code == 401


@pytest.mark.django_db
def test_logout_requires_refresh_in_body(api_client, user, user_password):
    tokens = _login(api_client, user.email, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    resp = api_client.post("/api/v1/auth/logout/", {}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_logout_requires_auth(api_client):
    resp = api_client.post(
        "/api/v1/auth/logout/", {"refresh": "whatever"}, format="json"
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_logout_all_blacklists_every_outstanding_token(api_client, user, user_password):
    _login(api_client, user.email, user_password)
    _login(api_client, user.email, user_password)
    tokens = _login(api_client, user.email, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    before = BlacklistedToken.objects.count()
    resp = api_client.post("/api/v1/auth/logout-all/")
    assert resp.status_code == 200
    assert resp.json()["blacklisted"] >= 3
    assert BlacklistedToken.objects.count() > before
