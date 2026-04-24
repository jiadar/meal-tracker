from datetime import date

import pytest

from api.models import User, WeightGoal


@pytest.mark.django_db
def test_weight_goal_requires_auth(api_client):
    assert api_client.get("/api/v1/weight-goals/").status_code == 401


@pytest.mark.django_db
def test_create_weight_goal(auth_client, user):
    resp = auth_client.post(
        "/api/v1/weight-goals/",
        {
            "start_date": "2026-04-05",
            "end_date": "2026-05-12",
            "start_weight": 167.4,
            "goal_weight": 160.0,
            "active": True,
        },
        format="json",
    )
    assert resp.status_code == 201
    assert WeightGoal.objects.filter(user=user).count() == 1


@pytest.mark.django_db
def test_weight_goal_multiple_per_user(auth_client):
    auth_client.post(
        "/api/v1/weight-goals/",
        {"start_date": "2025-10-01", "end_date": "2025-10-31", "start_weight": 180, "goal_weight": 170},
        format="json",
    )
    auth_client.post(
        "/api/v1/weight-goals/",
        {"start_date": "2026-04-05", "end_date": "2026-05-12", "start_weight": 167.4, "goal_weight": 160},
        format="json",
    )
    resp = auth_client.get("/api/v1/weight-goals/")
    assert resp.json()["count"] == 2


@pytest.mark.django_db
def test_weight_goal_end_before_start_rejected(auth_client):
    resp = auth_client.post(
        "/api/v1/weight-goals/",
        {
            "start_date": "2026-05-12",
            "end_date": "2026-04-05",
            "start_weight": 167.4,
            "goal_weight": 160.0,
        },
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_weight_goal_list_user_scoped(auth_client):
    other = User.objects.create_user(email="other@example.com", password="OtherPass!1")
    WeightGoal.objects.create(
        user=other,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 2, 1),
        start_weight=200,
        goal_weight=190,
    )
    resp = auth_client.get("/api/v1/weight-goals/")
    assert resp.json()["count"] == 0


@pytest.mark.django_db
def test_cannot_retrieve_another_users_weight_goal(auth_client):
    other = User.objects.create_user(email="other@example.com", password="OtherPass!1")
    goal = WeightGoal.objects.create(
        user=other,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 2, 1),
        start_weight=200,
        goal_weight=190,
    )
    resp = auth_client.get(f"/api/v1/weight-goals/{goal.id}/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_update_weight_goal(auth_client, user):
    goal = WeightGoal.objects.create(
        user=user,
        start_date=date(2026, 4, 5),
        end_date=date(2026, 5, 12),
        start_weight=167.4,
        goal_weight=160.0,
    )
    resp = auth_client.patch(
        f"/api/v1/weight-goals/{goal.id}/", {"active": False}, format="json"
    )
    assert resp.status_code == 200
    goal.refresh_from_db()
    assert goal.active is False
