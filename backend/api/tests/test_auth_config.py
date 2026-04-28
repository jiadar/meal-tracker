import pytest
from django.test import override_settings


def test_auth_config_no_authentication_required(api_client):
    resp = api_client.get("/api/v1/auth/config/")
    assert resp.status_code == 200


def test_auth_config_default_returns_true(api_client):
    resp = api_client.get("/api/v1/auth/config/")
    assert resp.status_code == 200
    assert resp.json() == {"allow_registration": True}


@override_settings(ALLOW_REGISTRATION=False)
def test_auth_config_when_disabled_returns_false(api_client):
    resp = api_client.get("/api/v1/auth/config/")
    assert resp.status_code == 200
    assert resp.json() == {"allow_registration": False}
