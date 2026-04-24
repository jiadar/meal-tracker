import pytest

from api.tests.conftest import error_codes, error_fields, error_messages


@pytest.mark.django_db
def test_validation_error_returns_flat_envelope(api_client):
    resp = api_client.post(
        "/api/v1/auth/register/",
        {"email": "bad", "password": "123"},
        format="json",
    )
    assert resp.status_code == 400
    body = resp.json()
    assert "errors" in body
    assert isinstance(body["errors"], list)
    for err in body["errors"]:
        assert set(err.keys()) == {"code", "field", "message"}
    fields = error_fields(resp)
    assert "email" in fields
    assert "password" in fields


@pytest.mark.django_db
def test_not_authenticated_returns_envelope(api_client):
    resp = api_client.get("/api/v1/foods/")
    assert resp.status_code == 401
    body = resp.json()
    assert "errors" in body
    assert len(body["errors"]) == 1
    err = body["errors"][0]
    assert err["field"] is None
    assert err["code"] == "not_authenticated"


@pytest.mark.django_db
def test_not_found_returns_envelope(auth_client):
    resp = auth_client.get("/api/v1/foods/00000000-0000-0000-0000-000000000000/")
    assert resp.status_code == 404
    body = resp.json()
    assert "errors" in body
    assert body["errors"][0]["field"] is None
