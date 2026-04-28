"""Tests for the chat view and tools.

The Agent SDK isn't called in tests — we patch ``_run_chat`` to yield canned
SSE frames. Tools are tested directly via ``asyncio.run`` after setting the
``current_user`` contextvar.
"""

import asyncio
import datetime as dt
import json

import pytest
from django.urls import reverse

from api.chat import scope, tools
from api.chat.views import _sse_frame
from api.models import Day, Food, Meal, NapLog, SleepLog


# ---------------------------------------------------------------------------
# View tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_chat_view_streams_canned_sse_frames(monkeypatch, auth_client):
    """The view should pipe whatever ``_run_chat`` yields straight to the client."""

    async def fake_run(messages):
        yield _sse_frame("text", {"delta": "Hello "})
        yield _sse_frame("text", {"delta": "world."})
        yield _sse_frame(
            "tool_call",
            {"name": "today", "input": {}, "result": "2026-04-25", "is_error": False},
        )
        yield _sse_frame("done", {})

    monkeypatch.setattr("api.chat.views._run_chat", fake_run)

    resp = auth_client.post(
        reverse("chat"),
        data={"messages": [{"role": "user", "content": "hi"}]},
        format="json",
    )
    assert resp.status_code == 200
    body = b"".join(resp.streaming_content).decode()
    assert "event: text" in body
    assert '"delta": "Hello "' in body
    assert "event: tool_call" in body
    assert "event: done" in body


@pytest.mark.django_db
def test_chat_view_rejects_when_last_message_not_user(auth_client):
    resp = auth_client.post(
        reverse("chat"),
        data={"messages": [{"role": "assistant", "content": "..."}]},
        format="json",
    )
    body = b"".join(resp.streaming_content).decode()
    assert "event: error" in body
    assert "last message must be from user" in body


@pytest.mark.django_db
def test_chat_view_requires_auth(api_client):
    resp = api_client.post(
        reverse("chat"),
        data={"messages": [{"role": "user", "content": "hi"}]},
        format="json",
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Tool tests — invoke the async tool functions directly.
# ---------------------------------------------------------------------------


def _run_tool(tool_callable, args: dict, user) -> dict:
    """Invoke a tool with the user scope set; return parsed JSON content."""

    async def go():
        scope.set_current_user(user)
        # SDK-decorated tools expose the original handler at .handler; call
        # via the public callable so the signature matches what the SDK uses.
        result = await tool_callable(args)
        return result

    return asyncio.run(go())


def _payload_text(result: dict) -> str:
    return result["content"][0]["text"]


def _payload_json(result: dict):
    return json.loads(_payload_text(result))


@pytest.mark.django_db(transaction=True)
def test_search_foods_filters_by_user_and_name(user, user_password):
    Food.objects.create(user=user, name="Banana", calories=89)
    Food.objects.create(user=user, name="Egg", calories=155)
    # Another user's food shouldn't leak.
    from api.models import User as UserModel

    other = UserModel.objects.create_user(
        email="eve@example.com", password=user_password, is_email_verified=True
    )
    Food.objects.create(user=other, name="Banana Bread", calories=350)

    result = _run_tool(tools.search_foods_impl, {"query": "ban", "limit": 10}, user)
    payload = _payload_json(result)
    names = [f["name"] for f in payload]
    assert names == ["Banana"]


@pytest.mark.django_db(transaction=True)
def test_get_or_create_day_idempotent(user):
    args = {"date": "2026-04-25", "location": "SD"}
    first = _payload_json(_run_tool(tools.get_or_create_day_impl, args, user))
    second = _payload_json(_run_tool(tools.get_or_create_day_impl, args, user))

    assert first["created"] is True
    assert second["created"] is False
    assert first["id"] == second["id"]
    assert Day.objects.filter(user=user).count() == 1


@pytest.mark.django_db(transaction=True)
def test_log_meal_inserts_row(user):
    food = Food.objects.create(user=user, name="Egg", calories=155)
    result = _payload_json(
        _run_tool(
            tools.log_meal_impl,
            {"date": "2026-04-25", "food_id": str(food.id), "grams": 100},
            user,
        )
    )
    assert result["food_name"] == "Egg"
    assert Meal.objects.filter(day__user=user).count() == 1


@pytest.mark.django_db(transaction=True)
def test_log_sleep_upsert_replaces_existing(user):
    args = {
        "date": "2026-04-25",
        "hours": 7.5,
        "quality": 4,
        "bedtime": "22:30",
        "wake": "06:00",
        "meds": False,
    }
    _run_tool(tools.log_sleep_impl, args, user)
    args["hours"] = 8.5
    args["quality"] = 5
    _run_tool(tools.log_sleep_impl, args, user)

    sleep = SleepLog.objects.get(day__user=user, day__date="2026-04-25")
    assert float(sleep.hours) == 8.5
    assert sleep.quality == 5
    assert sleep.bedtime == dt.time(22, 30)
    assert SleepLog.objects.filter(day__user=user).count() == 1


@pytest.mark.django_db(transaction=True)
def test_log_sleep_rejects_invalid_quality(user):
    args = {
        "date": "2026-04-25",
        "hours": 7.5,
        "quality": 9,
        "bedtime": "22:30",
        "wake": "06:00",
    }
    result = _run_tool(tools.log_sleep_impl, args, user)
    assert result.get("is_error") is True
    assert "1..5" in _payload_text(result)


@pytest.mark.django_db(transaction=True)
def test_log_nap_upsert(user):
    args = {"date": "2026-04-25", "hours": 1.0, "start_time": "15:00"}
    _run_tool(tools.log_nap_impl, args, user)
    assert NapLog.objects.filter(day__user=user).count() == 1


@pytest.mark.django_db(transaction=True)
def test_update_day_patches_only_provided_fields(user):
    Day.objects.create(user=user, date="2026-04-25", location="SD", weight_lbs=170)

    _run_tool(
        tools.update_day_impl,
        {"date": "2026-04-25", "weight_lbs": 168.5},
        user,
    )
    day = Day.objects.get(user=user, date="2026-04-25")
    assert float(day.weight_lbs) == 168.5
    assert day.location == "SD"  # unchanged


@pytest.mark.django_db(transaction=True)
def test_delete_meal_scopes_to_user(user, user_password):
    food = Food.objects.create(user=user, name="Egg", calories=155)
    day = Day.objects.create(user=user, date="2026-04-25")
    meal = Meal.objects.create(day=day, food=food, grams=50, position=0)

    result = _payload_json(_run_tool(tools.delete_meal_impl, {"meal_id": str(meal.id)}, user))
    assert result["deleted"] is True
    assert Meal.objects.filter(id=meal.id).count() == 0
