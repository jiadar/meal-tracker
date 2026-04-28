"""Chat tools — Python functions the Agent SDK exposes to the LLM.

Each tool has two pieces:

1. A plain ``async def _xxx_impl(args)`` function that contains the logic.
   Tests call this directly.
2. A ``@tool``-decorated wrapper that the SDK registers. The wrapper just
   delegates to the impl.

All tools auto-scope to the authenticated user via ``get_current_user()``
from scope.py.
"""

import datetime as dt
import json

from asgiref.sync import sync_to_async
from claude_agent_sdk import tool

from api.models import Day, ExerciseLog, Food, Meal, NapLog, SleepLog

from .scope import get_current_user


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _ok(payload) -> dict:
    text = payload if isinstance(payload, str) else json.dumps(payload, default=str)
    return {"content": [{"type": "text", "text": text}]}


def _err(message: str) -> dict:
    return {
        "content": [{"type": "text", "text": f"Error: {message}"}],
        "is_error": True,
    }


def _parse_date(s: str) -> dt.date:
    return dt.date.fromisoformat(s)


def _parse_time(s: str) -> dt.time:
    return dt.time.fromisoformat(s)


# ---------------------------------------------------------------------------
# implementations (directly testable)
# ---------------------------------------------------------------------------


async def today_impl(args: dict) -> dict:
    user = get_current_user()
    profile = await sync_to_async(lambda: user.profile)()
    today = profile.today()
    return _ok({"date": today.isoformat(), "timezone": profile.timezone})


async def search_foods_impl(args: dict) -> dict:
    user = get_current_user()
    query = args["query"].strip()
    limit = max(1, min(int(args.get("limit") or 10), 25))

    @sync_to_async
    def _query():
        return list(
            Food.objects.filter(user=user, name__icontains=query).order_by("name")[:limit]
        )

    foods = await _query()
    return _ok(
        [
            {
                "id": str(f.id),
                "name": f.name,
                "calories_per_100g": float(f.calories),
                "protein_per_100g": float(f.protein),
                "fat_per_100g": float(f.fat),
                "carbs_per_100g": float(f.carbs),
            }
            for f in foods
        ]
    )


async def get_or_create_day_impl(args: dict) -> dict:
    user = get_current_user()
    try:
        date = _parse_date(args["date"])
    except ValueError as e:
        return _err(f"invalid date: {e}")
    location = args.get("location") or "SD"

    @sync_to_async
    def _go():
        return Day.objects.get_or_create(
            user=user, date=date, defaults={"location": location}
        )

    day, created = await _go()
    return _ok(
        {
            "id": str(day.id),
            "date": day.date.isoformat(),
            "location": day.location,
            "created": created,
        }
    )


async def log_meal_impl(args: dict) -> dict:
    user = get_current_user()
    try:
        date = _parse_date(args["date"])
    except ValueError as e:
        return _err(f"invalid date: {e}")
    grams = float(args["grams"])
    if grams <= 0:
        return _err("grams must be > 0")

    @sync_to_async
    def _go():
        food = Food.objects.filter(user=user, id=args["food_id"]).first()
        if not food:
            return None, "food not found"
        day, _ = Day.objects.get_or_create(user=user, date=date)
        position = day.meals.count()
        meal = Meal.objects.create(day=day, food=food, grams=grams, position=position)
        return meal, food.name

    meal, food_name = await _go()
    if meal is None:
        return _err(food_name)
    return _ok(
        {
            "id": str(meal.id),
            "day_date": date.isoformat(),
            "food_name": food_name,
            "grams": float(meal.grams),
        }
    )


async def update_day_impl(args: dict) -> dict:
    user = get_current_user()
    try:
        date = _parse_date(args["date"])
    except ValueError as e:
        return _err(f"invalid date: {e}")

    @sync_to_async
    def _go():
        day, _ = Day.objects.get_or_create(user=user, date=date)
        if "weight_lbs" in args and args["weight_lbs"] is not None:
            day.weight_lbs = args["weight_lbs"]
        if "location" in args and args["location"]:
            day.location = args["location"]
        if "creatine_mg" in args and args["creatine_mg"] is not None:
            day.creatine_mg = args["creatine_mg"]
        day.save()
        return day

    day = await _go()
    return _ok(
        {
            "date": day.date.isoformat(),
            "weight_lbs": float(day.weight_lbs) if day.weight_lbs is not None else None,
            "location": day.location,
            "creatine_mg": day.creatine_mg,
        }
    )


async def log_exercise_impl(args: dict) -> dict:
    user = get_current_user()
    try:
        date = _parse_date(args["date"])
    except ValueError as e:
        return _err(f"invalid date: {e}")

    @sync_to_async
    def _go():
        day, _ = Day.objects.get_or_create(user=user, date=date)
        position = day.exercises.count()
        return ExerciseLog.objects.create(
            day=day,
            activity=args["activity"],
            calories=int(args["calories"]),
            duration_minutes=args.get("minutes"),
            position=position,
        )

    log = await _go()
    return _ok(
        {
            "id": str(log.id),
            "activity": log.activity,
            "calories": log.calories,
            "minutes": log.duration_minutes,
        }
    )


async def log_sleep_impl(args: dict) -> dict:
    user = get_current_user()
    try:
        date = _parse_date(args["date"])
        bedtime = _parse_time(args["bedtime"])
        wake = _parse_time(args["wake"])
    except ValueError as e:
        return _err(f"invalid date/time: {e}")
    quality = int(args["quality"])
    if not 1 <= quality <= 5:
        return _err("quality must be 1..5")

    @sync_to_async
    def _go():
        day, _ = Day.objects.get_or_create(user=user, date=date)
        sleep, _ = SleepLog.objects.update_or_create(
            day=day,
            defaults={
                "hours": args["hours"],
                "quality": quality,
                "bedtime": bedtime,
                "wake": wake,
                "meds": bool(args.get("meds", False)),
            },
        )
        return sleep

    sleep = await _go()
    return _ok(
        {
            "date": date.isoformat(),
            "hours": float(sleep.hours),
            "quality": sleep.quality,
            "bedtime": sleep.bedtime.isoformat(timespec="minutes"),
            "wake": sleep.wake.isoformat(timespec="minutes"),
            "meds": sleep.meds,
        }
    )


async def log_nap_impl(args: dict) -> dict:
    user = get_current_user()
    try:
        date = _parse_date(args["date"])
        start_time = _parse_time(args["start_time"])
    except ValueError as e:
        return _err(f"invalid date/time: {e}")

    @sync_to_async
    def _go():
        day, _ = Day.objects.get_or_create(user=user, date=date)
        nap, _ = NapLog.objects.update_or_create(
            day=day,
            defaults={"hours": args["hours"], "start_time": start_time},
        )
        return nap

    nap = await _go()
    return _ok(
        {
            "date": date.isoformat(),
            "hours": float(nap.hours),
            "start_time": nap.start_time.isoformat(timespec="minutes"),
        }
    )


async def delete_meal_impl(args: dict) -> dict:
    user = get_current_user()

    @sync_to_async
    def _go():
        deleted, _ = Meal.objects.filter(day__user=user, id=args["meal_id"]).delete()
        return deleted

    deleted = await _go()
    if deleted == 0:
        return _err("meal not found")
    return _ok({"deleted": True})


# ---------------------------------------------------------------------------
# SDK-decorated wrappers (delegate to impls). Order is stable so prompt
# caching works.
# ---------------------------------------------------------------------------

today_tool = tool("today", "Get today's date and the user's timezone.", {})(today_impl)

search_foods_tool = tool(
    "search_foods",
    "Search the user's food database by name (case-insensitive substring). Returns up to `limit` matches.",
    {"query": str, "limit": int},
)(search_foods_impl)

get_or_create_day_tool = tool(
    "get_or_create_day",
    "Get or create a Day record for the given date. Returns the day's id.",
    {"date": str, "location": str},
)(get_or_create_day_impl)

log_meal_tool = tool(
    "log_meal",
    "Log a meal: insert a Meal row for the given date, food_id, and grams. Creates the day if missing.",
    {"date": str, "food_id": str, "grams": float},
)(log_meal_impl)

update_day_tool = tool(
    "update_day",
    "Update day-level fields (weight_lbs, location, creatine_mg). Pass only the fields you want to change.",
    {"date": str, "weight_lbs": float, "location": str, "creatine_mg": int},
)(update_day_impl)

log_exercise_tool = tool(
    "log_exercise",
    "Log an exercise entry for the given date.",
    {"date": str, "activity": str, "calories": int, "minutes": int},
)(log_exercise_impl)

log_sleep_tool = tool(
    "log_sleep",
    "Log overnight sleep for the WAKE-UP date (PSQI convention). Upserts the OneToOne SleepLog.",
    {
        "date": str,
        "hours": float,
        "quality": int,
        "bedtime": str,
        "wake": str,
        "meds": bool,
    },
)(log_sleep_impl)

log_nap_tool = tool(
    "log_nap",
    "Log a nap for the given date. Upserts the OneToOne NapLog.",
    {"date": str, "hours": float, "start_time": str},
)(log_nap_impl)

delete_meal_tool = tool(
    "delete_meal",
    "Delete a meal by id. ALWAYS confirm with the user before calling.",
    {"meal_id": str},
)(delete_meal_impl)


ALL_TOOLS = [
    today_tool,
    search_foods_tool,
    get_or_create_day_tool,
    log_meal_tool,
    update_day_tool,
    log_exercise_tool,
    log_sleep_tool,
    log_nap_tool,
    delete_meal_tool,
]
