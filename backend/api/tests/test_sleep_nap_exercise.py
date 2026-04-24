from datetime import date

import pytest

from api.models import Day, ExerciseLog, NapLog, SleepLog, User


@pytest.fixture
def day(user):
    return Day.objects.create(user=user, date=date(2026, 4, 23))


# ---------- Sleep ----------


@pytest.mark.django_db
def test_create_sleep_log(auth_client, day):
    resp = auth_client.post(
        "/api/v1/sleep-logs/",
        {
            "day": str(day.id),
            "hours": 7.6,
            "quality": 4,
            "bedtime": "22:10",
            "wake": "05:55",
            "meds": False,
        },
        format="json",
    )
    assert resp.status_code == 201
    assert SleepLog.objects.filter(day=day).count() == 1


@pytest.mark.django_db
def test_sleep_one_per_day(auth_client, day):
    auth_client.post(
        "/api/v1/sleep-logs/",
        {"day": str(day.id), "hours": 7, "quality": 3, "bedtime": "22:00", "wake": "05:00"},
        format="json",
    )
    resp = auth_client.post(
        "/api/v1/sleep-logs/",
        {"day": str(day.id), "hours": 6, "quality": 2, "bedtime": "23:00", "wake": "05:00"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_sleep_invalid_quality_rejected(auth_client, day):
    resp = auth_client.post(
        "/api/v1/sleep-logs/",
        {"day": str(day.id), "hours": 7, "quality": 9, "bedtime": "22:00", "wake": "05:00"},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_sleep_must_use_own_day(auth_client):
    other = User.objects.create_user(email="other@example.com", password="OtherPass!1")
    other_day = Day.objects.create(user=other, date=date(2026, 4, 23))
    resp = auth_client.post(
        "/api/v1/sleep-logs/",
        {"day": str(other_day.id), "hours": 7, "quality": 3, "bedtime": "22:00", "wake": "05:00"},
        format="json",
    )
    assert resp.status_code == 400


# ---------- Nap ----------


@pytest.mark.django_db
def test_create_nap_log(auth_client, day):
    resp = auth_client.post(
        "/api/v1/nap-logs/",
        {"day": str(day.id), "hours": 1, "start_time": "15:00"},
        format="json",
    )
    assert resp.status_code == 201
    assert NapLog.objects.filter(day=day).count() == 1


@pytest.mark.django_db
def test_nap_one_per_day(auth_client, day):
    auth_client.post(
        "/api/v1/nap-logs/",
        {"day": str(day.id), "hours": 1, "start_time": "15:00"},
        format="json",
    )
    resp = auth_client.post(
        "/api/v1/nap-logs/",
        {"day": str(day.id), "hours": 0.5, "start_time": "16:00"},
        format="json",
    )
    assert resp.status_code == 400


# ---------- Exercise ----------


@pytest.mark.django_db
def test_create_exercise_log(auth_client, day):
    resp = auth_client.post(
        "/api/v1/exercise-logs/",
        {
            "day": str(day.id),
            "activity": "Jiu Jitsu",
            "duration_minutes": 90,
            "calories": 600,
            "position": 0,
        },
        format="json",
    )
    assert resp.status_code == 201
    assert ExerciseLog.objects.filter(day=day).count() == 1


@pytest.mark.django_db
def test_multiple_exercises_per_day(auth_client, day):
    for i, activity in enumerate(["BJJ", "Walk"]):
        resp = auth_client.post(
            "/api/v1/exercise-logs/",
            {"day": str(day.id), "activity": activity, "calories": 200, "position": i},
            format="json",
        )
        assert resp.status_code == 201
    assert ExerciseLog.objects.filter(day=day).count() == 2


@pytest.mark.django_db
def test_exercise_must_use_own_day(auth_client):
    other = User.objects.create_user(email="other@example.com", password="OtherPass!1")
    other_day = Day.objects.create(user=other, date=date(2026, 4, 23))
    resp = auth_client.post(
        "/api/v1/exercise-logs/",
        {"day": str(other_day.id), "activity": "BJJ", "calories": 500},
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_exercise_filter_by_day(auth_client, user, day):
    day_b = Day.objects.create(user=user, date=date(2026, 4, 24))
    ExerciseLog.objects.create(day=day, activity="BJJ", calories=500, position=0)
    ExerciseLog.objects.create(day=day_b, activity="Walk", calories=100, position=0)
    resp = auth_client.get(f"/api/v1/exercise-logs/?day={day.id}")
    assert resp.json()["count"] == 1


@pytest.mark.django_db
def test_day_detail_embeds_sleep_nap_exercises(auth_client, day):
    SleepLog.objects.create(
        day=day, hours=7, quality=4, bedtime="22:00", wake="05:00"
    )
    NapLog.objects.create(day=day, hours=1, start_time="15:00")
    ExerciseLog.objects.create(day=day, activity="BJJ", calories=500, position=0)
    resp = auth_client.get(f"/api/v1/days/{day.id}/")
    body = resp.json()
    assert body["sleep"] is not None
    assert body["sleep"]["quality"] == 4
    assert body["nap"]["hours"] == "1.00"
    assert len(body["exercises"]) == 1
    assert body["exercises"][0]["activity"] == "BJJ"
