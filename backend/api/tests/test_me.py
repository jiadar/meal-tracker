import pytest

from api.models import User


@pytest.mark.django_db
def test_me_requires_auth(api_client):
    resp = api_client.get("/api/v1/auth/me/")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_me_returns_user_with_profile(auth_client, user):
    resp = auth_client.get("/api/v1/auth/me/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == user.email
    assert body["profile"]["bmr"] == 1970
    assert body["profile"]["timezone"] == "UTC"


@pytest.mark.django_db
def test_me_patch_updates_profile_fields(auth_client, user):
    resp = auth_client.patch(
        "/api/v1/auth/me/",
        {"profile": {"display_name": "Ali", "timezone": "America/Los_Angeles", "bmr": 2100}},
        format="json",
    )
    assert resp.status_code == 200
    user.profile.refresh_from_db()
    assert user.profile.display_name == "Ali"
    assert user.profile.timezone == "America/Los_Angeles"
    assert user.profile.bmr == 2100


@pytest.mark.django_db
def test_me_patch_cannot_change_email(auth_client, user):
    original_email = user.email
    resp = auth_client.patch(
        "/api/v1/auth/me/", {"email": "hacker@example.com"}, format="json"
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.email == original_email


@pytest.mark.django_db
def test_me_patch_cannot_change_verified_flag(auth_client, user):
    # user fixture is verified=True; try to flip it
    resp = auth_client.patch(
        "/api/v1/auth/me/", {"is_email_verified": False}, format="json"
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.is_email_verified is True


@pytest.mark.django_db
def test_me_delete_removes_account(auth_client, user):
    user_id = user.pk
    resp = auth_client.delete("/api/v1/auth/me/")
    assert resp.status_code == 204
    assert not User.objects.filter(pk=user_id).exists()


@pytest.mark.django_db
def test_me_delete_blacklists_outstanding_refresh_tokens(api_client, user, user_password):
    login = api_client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": user_password},
        format="json",
    ).json()
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login['access']}")
    assert api_client.delete("/api/v1/auth/me/").status_code == 204
    refresh = api_client.post(
        "/api/v1/auth/refresh/", {"refresh": login["refresh"]}, format="json"
    )
    assert refresh.status_code == 401
