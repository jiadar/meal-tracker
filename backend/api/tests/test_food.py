from decimal import Decimal

import pytest

from api.models import Food, User


def _food_payload(name="Banana", **overrides):
    base = {
        "name": name,
        "calories": 89,
        "fat": 0.33,
        "sat_fat": 0,
        "cholesterol": 0,
        "sodium": 1,
        "carbs": 22.8,
        "fiber": 2.6,
        "sugar": 12.2,
        "add_sugar": 0,
        "protein": 1.1,
    }
    base.update(overrides)
    return base


@pytest.mark.django_db
def test_food_requires_auth(api_client):
    assert api_client.get("/api/v1/foods/").status_code == 401


@pytest.mark.django_db
def test_food_list_empty_for_new_user(auth_client):
    resp = auth_client.get("/api/v1/foods/")
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


@pytest.mark.django_db
def test_create_food(auth_client, user):
    resp = auth_client.post("/api/v1/foods/", _food_payload(), format="json")
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Banana"
    assert Decimal(body["calories"]) == Decimal("89.0000")
    assert body["is_composite"] is False
    assert body["has_recipe"] is False
    assert Food.objects.filter(user=user).count() == 1


@pytest.mark.django_db
def test_create_food_duplicate_name_rejected(auth_client):
    auth_client.post("/api/v1/foods/", _food_payload("Egg"), format="json")
    resp = auth_client.post("/api/v1/foods/", _food_payload("Egg"), format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_food_list_is_user_scoped(auth_client, db):
    other = User.objects.create_user(email="other@example.com", password="OtherPass!1")
    Food.objects.create(user=other, name="Stranger Food", calories=100)
    resp = auth_client.get("/api/v1/foods/")
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


@pytest.mark.django_db
def test_cannot_retrieve_another_users_food(auth_client, db):
    other = User.objects.create_user(email="other@example.com", password="OtherPass!1")
    their_food = Food.objects.create(user=other, name="Their Food", calories=100)
    resp = auth_client.get(f"/api/v1/foods/{their_food.id}/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_food_name_search(auth_client):
    auth_client.post("/api/v1/foods/", _food_payload("Banana"), format="json")
    auth_client.post("/api/v1/foods/", _food_payload("Bagel"), format="json")
    auth_client.post("/api/v1/foods/", _food_payload("Egg White"), format="json")
    resp = auth_client.get("/api/v1/foods/?name=ba")
    assert resp.status_code == 200
    names = {item["name"] for item in resp.json()["results"]}
    assert names == {"Banana", "Bagel"}


@pytest.mark.django_db
def test_update_food(auth_client):
    create = auth_client.post("/api/v1/foods/", _food_payload(), format="json").json()
    resp = auth_client.patch(
        f"/api/v1/foods/{create['id']}/", {"calories": 100}, format="json"
    )
    assert resp.status_code == 200
    assert Decimal(resp.json()["calories"]) == Decimal("100.0000")


@pytest.mark.django_db
def test_delete_food(auth_client):
    create = auth_client.post("/api/v1/foods/", _food_payload(), format="json").json()
    resp = auth_client.delete(f"/api/v1/foods/{create['id']}/")
    assert resp.status_code == 204
    assert Food.objects.count() == 0
