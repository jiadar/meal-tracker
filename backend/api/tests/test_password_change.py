import pytest


@pytest.mark.django_db
def test_change_password_requires_auth(api_client):
    resp = api_client.post(
        "/api/v1/auth/password/change/",
        {"old_password": "x", "new_password": "y"},
        format="json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_change_password_success(auth_client, user, user_password):
    resp = auth_client.post(
        "/api/v1/auth/password/change/",
        {"old_password": user_password, "new_password": "NewStrongPass!456"},
        format="json",
    )
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.check_password("NewStrongPass!456")


@pytest.mark.django_db
def test_change_password_wrong_old_rejected(auth_client, user, user_password):
    resp = auth_client.post(
        "/api/v1/auth/password/change/",
        {"old_password": "wrong", "new_password": "NewStrongPass!456"},
        format="json",
    )
    assert resp.status_code == 400
    user.refresh_from_db()
    assert user.check_password(user_password)


@pytest.mark.django_db
def test_change_password_weak_new_rejected(auth_client, user_password):
    resp = auth_client.post(
        "/api/v1/auth/password/change/",
        {"old_password": user_password, "new_password": "123"},
        format="json",
    )
    assert resp.status_code == 400
