import pytest

from api.models import UserTargets


@pytest.mark.django_db
def test_new_user_gets_targets_with_defaults(user):
    targets = UserTargets.objects.get(user=user)
    assert float(targets.fat_pct_low) == 20
    assert float(targets.fat_pct_high) == 35
    assert float(targets.fiber_low) == 28
    assert float(targets.sodium_high) == 2300
    assert targets.sleep_quality_low == 4


@pytest.mark.django_db
def test_targets_requires_auth(api_client):
    resp = api_client.get("/api/v1/targets/")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_get_own_targets(auth_client):
    resp = auth_client.get("/api/v1/targets/")
    assert resp.status_code == 200
    body = resp.json()
    assert float(body["fat_pct_high"]) == 35
    assert body["sleep_quality_low"] == 4


@pytest.mark.django_db
def test_patch_targets_updates_values(auth_client, user):
    resp = auth_client.patch(
        "/api/v1/targets/",
        {"fat_pct_high": 30, "sodium_high": 2000, "sleep_quality_low": 5},
        format="json",
    )
    assert resp.status_code == 200
    targets = UserTargets.objects.get(user=user)
    assert float(targets.fat_pct_high) == 30
    assert float(targets.sodium_high) == 2000
    assert targets.sleep_quality_low == 5


@pytest.mark.django_db
def test_patch_targets_rejects_invalid_sleep_quality(auth_client):
    resp = auth_client.patch(
        "/api/v1/targets/", {"sleep_quality_low": 9}, format="json"
    )
    assert resp.status_code == 400
