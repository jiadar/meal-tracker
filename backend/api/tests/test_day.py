from datetime import date
from decimal import Decimal

import pytest

from api.models import Day, Food, Meal, User


@pytest.fixture
def banana(user):
    return Food.objects.create(user=user, name="Banana", calories=89, protein=Decimal("1.1"))


@pytest.mark.django_db
def test_day_requires_auth(api_client):
    assert api_client.get("/api/v1/days/").status_code == 401


@pytest.mark.django_db
def test_create_day(auth_client, user):
    resp = auth_client.post(
        "/api/v1/days/",
        {"date": "2026-04-23", "location": "SD", "weight_lbs": 167.4, "creatine_mg": 5},
        format="json",
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["date"] == "2026-04-23"
    assert body["meals"] == []
    assert body["sleep"] is None
    assert body["nap"] is None
    assert body["exercises"] == []
    assert Day.objects.filter(user=user).count() == 1


@pytest.mark.django_db
def test_create_day_location_defaults_to_sd(auth_client):
    resp = auth_client.post("/api/v1/days/", {"date": "2026-04-23"}, format="json")
    assert resp.status_code == 201
    assert resp.json()["location"] == "SD"


@pytest.mark.django_db
def test_day_unique_per_user_date(auth_client):
    auth_client.post("/api/v1/days/", {"date": "2026-04-23"}, format="json")
    resp = auth_client.post("/api/v1/days/", {"date": "2026-04-23"}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_day_list_scoped_to_user(auth_client, user):
    other = User.objects.create_user(email="other@example.com", password="OtherPass!1")
    Day.objects.create(user=other, date=date(2026, 4, 23))
    Day.objects.create(user=user, date=date(2026, 4, 22))
    resp = auth_client.get("/api/v1/days/")
    assert resp.json()["count"] == 1


@pytest.mark.django_db
def test_day_date_filter(auth_client, user):
    for d in [date(2026, 4, 20), date(2026, 4, 22), date(2026, 4, 25)]:
        Day.objects.create(user=user, date=d)
    resp = auth_client.get("/api/v1/days/?from=2026-04-21&to=2026-04-23")
    assert resp.json()["count"] == 1


@pytest.mark.django_db
def test_create_meal_attaches_to_day(auth_client, user, banana):
    day = Day.objects.create(user=user, date=date(2026, 4, 23))
    resp = auth_client.post(
        "/api/v1/meals/",
        {"day": str(day.id), "food": str(banana.id), "grams": 150, "position": 0},
        format="json",
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["food_name"] == "Banana"
    assert Meal.objects.filter(day=day).count() == 1


@pytest.mark.django_db
def test_meal_must_use_own_day(auth_client, user, banana):
    other = User.objects.create_user(email="other@example.com", password="OtherPass!1")
    other_day = Day.objects.create(user=other, date=date(2026, 4, 23))
    resp = auth_client.post(
        "/api/v1/meals/",
        {"day": str(other_day.id), "food": str(banana.id), "grams": 150},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_meal_must_use_own_food(auth_client, user):
    other = User.objects.create_user(email="other@example.com", password="OtherPass!1")
    other_food = Food.objects.create(user=other, name="Stranger Food", calories=100)
    day = Day.objects.create(user=user, date=date(2026, 4, 23))
    resp = auth_client.post(
        "/api/v1/meals/",
        {"day": str(day.id), "food": str(other_food.id), "grams": 100},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_day_detail_embeds_nested_meals_and_sleep(auth_client, user, banana):
    day = Day.objects.create(user=user, date=date(2026, 4, 23))
    Meal.objects.create(day=day, food=banana, grams=150, position=0)
    resp = auth_client.get(f"/api/v1/days/{day.id}/")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["meals"]) == 1
    assert body["meals"][0]["food_name"] == "Banana"


@pytest.mark.django_db
def test_meal_filter_by_day(auth_client, user, banana):
    day_a = Day.objects.create(user=user, date=date(2026, 4, 20))
    day_b = Day.objects.create(user=user, date=date(2026, 4, 21))
    Meal.objects.create(day=day_a, food=banana, grams=100, position=0)
    Meal.objects.create(day=day_b, food=banana, grams=100, position=0)
    resp = auth_client.get(f"/api/v1/meals/?day={day_a.id}")
    assert resp.json()["count"] == 1


@pytest.mark.django_db
def test_duplicate_food_on_same_day_is_allowed(auth_client, user, banana):
    day = Day.objects.create(user=user, date=date(2026, 4, 23))
    r1 = auth_client.post(
        "/api/v1/meals/",
        {"day": str(day.id), "food": str(banana.id), "grams": 150, "position": 0},
        format="json",
    )
    r2 = auth_client.post(
        "/api/v1/meals/",
        {"day": str(day.id), "food": str(banana.id), "grams": 100, "position": 1},
        format="json",
    )
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert Meal.objects.filter(day=day).count() == 2
