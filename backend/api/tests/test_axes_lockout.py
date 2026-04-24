import pytest


@pytest.fixture
def _axes_enabled(settings):
    settings.AXES_ENABLED = True
    settings.AXES_FAILURE_LIMIT = 3
    settings.AXES_RESET_ON_SUCCESS = True
    # Clear any previous axes state
    from axes.models import AccessAttempt, AccessLog
    AccessAttempt.objects.all().delete()
    AccessLog.objects.all().delete()


@pytest.mark.django_db
def test_login_locks_out_after_failed_attempts(api_client, user, user_password, _axes_enabled):
    for _ in range(3):
        resp = api_client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "wrong"},
            format="json",
        )
        assert resp.status_code == 401

    # Correct password must NOT succeed while locked out
    resp = api_client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": user_password},
        format="json",
    )
    assert resp.status_code != 200
    from axes.models import AccessAttempt
    assert AccessAttempt.objects.filter(username=user.email).exists()


@pytest.mark.django_db
def test_successful_login_resets_failure_counter(api_client, user, user_password, _axes_enabled):
    # Two wrong attempts
    for _ in range(2):
        api_client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "wrong"},
            format="json",
        )
    # Correct login resets counter
    resp = api_client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": user_password},
        format="json",
    )
    assert resp.status_code == 200
    # Two more wrong attempts shouldn't lock us out (counter reset to 0)
    for _ in range(2):
        resp = api_client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "wrong"},
            format="json",
        )
        assert resp.status_code == 401
