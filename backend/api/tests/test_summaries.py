from datetime import date
from decimal import Decimal

import pytest

from api.models import Day, ExerciseLog, Food, Meal, SleepLog


@pytest.fixture
def banana(user):
    return Food.objects.create(
        user=user, name="Banana", calories=89, fat=Decimal("0.33"),
        carbs=Decimal("22.8"), protein=Decimal("1.1"), fiber=Decimal("2.6"),
    )


@pytest.fixture
def olive_oil(user):
    return Food.objects.create(
        user=user, name="Olive Oil", calories=884, fat=100, sat_fat=14,
    )


@pytest.mark.django_db
def test_today_endpoint_returns_user_local_date(auth_client, user):
    user.profile.timezone = "America/Los_Angeles"
    user.profile.save()
    resp = auth_client.get("/api/v1/today/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["timezone"] == "America/Los_Angeles"
    assert len(body["date"]) == 10  # YYYY-MM-DD


@pytest.mark.django_db
def test_invalid_timezone_rejected_on_profile_update(auth_client):
    resp = auth_client.patch(
        "/api/v1/auth/me/", {"profile": {"timezone": "Mars/Olympus"}}, format="json"
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_day_response_includes_summary(auth_client, user, banana, olive_oil):
    day = Day.objects.create(user=user, date=date(2026, 4, 23))
    Meal.objects.create(day=day, food=banana, grams=100, position=0)
    Meal.objects.create(day=day, food=olive_oil, grams=15, position=1)
    ExerciseLog.objects.create(day=day, activity="BJJ", calories=500, position=0)

    resp = auth_client.get(f"/api/v1/days/{day.id}/")
    assert resp.status_code == 200
    body = resp.json()
    assert "summary" in body
    s = body["summary"]
    # 100g banana (89 cal) + 15g olive oil (884 * 0.15 = 132.6 cal) = 221.6 cal
    assert s["totals"]["calories"] == 221.6
    assert s["bmr"] == 1970
    assert s["exercise_calories"] == 500
    assert s["allowed_calories"] == 2470
    assert s["is_deficit"] is True


@pytest.mark.django_db
def test_meal_response_includes_nutrition_and_food_per_100g(auth_client, user, banana):
    day = Day.objects.create(user=user, date=date(2026, 4, 23))
    meal = Meal.objects.create(day=day, food=banana, grams=150, position=0)
    resp = auth_client.get(f"/api/v1/meals/?day={day.id}")
    result = resp.json()["results"][0]
    assert result["food_per_100g"]["calories"] == 89.0
    # 150g banana @ 89 cal/100g = 133.5 cal
    assert result["nutrition"]["calories"] == 133.5


@pytest.mark.django_db
def test_month_summary_aggregates_across_days(auth_client, user, banana):
    d1 = Day.objects.create(user=user, date=date(2026, 4, 10), weight_lbs=Decimal("167.4"))
    d2 = Day.objects.create(user=user, date=date(2026, 4, 15), weight_lbs=Decimal("166.0"))
    d3 = Day.objects.create(user=user, date=date(2026, 4, 20), weight_lbs=Decimal("165.5"))
    Meal.objects.create(day=d1, food=banana, grams=100, position=0)
    Meal.objects.create(day=d2, food=banana, grams=200, position=0)
    SleepLog.objects.create(day=d1, hours=Decimal("7.5"), quality=4, bedtime="22:00", wake="05:30")
    SleepLog.objects.create(day=d2, hours=Decimal("8.0"), quality=5, bedtime="22:00", wake="06:00")

    resp = auth_client.get("/api/v1/months/2026-4/summary/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["year"] == 2026
    assert body["month"] == 4
    assert body["days_tracked"] == 3
    assert body["weight"]["start"] == 167.4
    assert body["weight"]["end"] == 165.5
    assert body["weight"]["change"] == 1.9  # lost 1.9 lbs
    assert body["weight"]["low"] == 165.5
    assert body["sleep"]["days_with_data"] == 2
    assert body["sleep"]["avg_hours"] == 7.75
    assert body["sleep"]["avg_quality"] == 4.5


@pytest.mark.django_db
def test_month_summary_empty_month(auth_client):
    resp = auth_client.get("/api/v1/months/2020-1/summary/")
    assert resp.status_code == 200
    assert resp.json()["days_tracked"] == 0


@pytest.mark.django_db
def test_month_summary_requires_auth(api_client):
    assert api_client.get("/api/v1/months/2026-4/summary/").status_code == 401


@pytest.mark.django_db
def test_openapi_schema_available(api_client):
    resp = api_client.get("/api/v1/schema/")
    assert resp.status_code == 200
    # drf-spectacular defaults to YAML for the schema endpoint
    assert b"openapi" in resp.content.lower()


@pytest.mark.django_db
def test_swagger_docs_available(api_client):
    resp = api_client.get("/api/v1/docs/")
    assert resp.status_code == 200
    assert b"swagger" in resp.content.lower()


@pytest.mark.django_db
def test_create_day_without_date_uses_user_today(auth_client, user):
    user.profile.timezone = "America/Los_Angeles"
    user.profile.save()
    resp = auth_client.post("/api/v1/days/", {}, format="json")
    assert resp.status_code == 201
    assert resp.json()["date"] == user.profile.today().isoformat()
