import json
from datetime import date
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import (
    Day,
    ExerciseLog,
    Food,
    Meal,
    NapLog,
    SleepLog,
    User,
)

MONTH_NAMES = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def parse_month_id(month_id: str) -> tuple[int, int]:
    """'apr2026' -> (2026, 4), 'oct2025' -> (2025, 10)."""
    prefix = month_id[:3].lower()
    year = int(month_id[3:])
    if prefix not in MONTH_NAMES:
        raise ValueError(f"Unknown month prefix: {prefix!r}")
    return year, MONTH_NAMES[prefix]


NUTRIENT_FIELD_MAP = {
    "calories": "calories",
    "fat": "fat",
    "satFat": "sat_fat",
    "cholesterol": "cholesterol",
    "sodium": "sodium",
    "carbs": "carbs",
    "fiber": "fiber",
    "sugar": "sugar",
    "addSugar": "add_sugar",
    "protein": "protein",
}


class Command(BaseCommand):
    help = "Import a meal-tracker JSON export into a specific user's data."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="Target user's email.")
        parser.add_argument("--file", required=True, help="Path to meal-tracker-data.json.")
        parser.add_argument(
            "--wipe",
            action="store_true",
            help="Delete the user's existing Foods/Days before importing.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse the file and print counts but don't write to the DB.",
        )

    def handle(self, *args, **opts):
        path = Path(opts["file"])
        if not path.exists():
            raise CommandError(f"File not found: {path}")

        try:
            user = User.objects.get(email__iexact=opts["email"])
        except User.DoesNotExist:
            raise CommandError(f"User not found: {opts['email']}")

        data = json.loads(path.read_text())

        food_db = data.get("foodDatabase") or {}
        months = data.get("months") or {}

        if opts["dry_run"]:
            day_count = sum(len(m.get("days", {})) for m in months.values())
            meal_count = sum(
                len(d.get("meals", []))
                for m in months.values()
                for d in m.get("days", {}).values()
            )
            self.stdout.write(
                f"[dry-run] Would import: {len(food_db)} foods, "
                f"{day_count} days, {meal_count} meals."
            )
            return

        with transaction.atomic():
            if opts["wipe"]:
                user.foods.all().delete()
                user.days.all().delete()

            foods_by_name = self._import_foods(user, food_db)
            day_count, meal_count, sleep_count, nap_count, exercise_count = (
                self._import_months(user, months, foods_by_name)
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Imported for {user.email}: "
                f"{len(foods_by_name)} foods, {day_count} days, "
                f"{meal_count} meals, {sleep_count} sleep, "
                f"{nap_count} nap, {exercise_count} exercise."
            )
        )

    def _import_foods(self, user, food_db: dict) -> dict:
        result = {}
        for name, nutrients in food_db.items():
            fields = {"user": user, "name": name}
            for src, dst in NUTRIENT_FIELD_MAP.items():
                if src in nutrients:
                    fields[dst] = Decimal(str(nutrients[src]))
            food, _ = Food.objects.update_or_create(
                user=user, name=name, defaults={k: v for k, v in fields.items() if k not in ("user", "name")}
            )
            result[name] = food
        return result

    def _import_months(self, user, months: dict, foods_by_name: dict):
        day_count = meal_count = sleep_count = nap_count = exercise_count = 0

        for month_id, month_obj in months.items():
            year, month = parse_month_id(month_id)
            for day_num_str, day_data in (month_obj.get("days") or {}).items():
                day_date = date(year, month, int(day_num_str))

                day, _ = Day.objects.update_or_create(
                    user=user,
                    date=day_date,
                    defaults={
                        "location": day_data.get("location", "SD") or "SD",
                        "weight_lbs": (
                            Decimal(str(day_data["weight"]))
                            if day_data.get("weight") is not None
                            else None
                        ),
                        "creatine_mg": day_data.get("creatine"),
                    },
                )
                day_count += 1

                # Meals
                day.meals.all().delete()
                for position, meal in enumerate(day_data.get("meals", [])):
                    food = foods_by_name.get(meal["item"])
                    if food is None:
                        self.stdout.write(
                            self.style.WARNING(
                                f"  ! Skipping meal — unknown food {meal['item']!r} on {day_date}"
                            )
                        )
                        continue
                    Meal.objects.create(
                        day=day,
                        food=food,
                        grams=Decimal(str(meal["grams"])),
                        position=position,
                    )
                    meal_count += 1

                # Sleep
                sleep = day_data.get("sleep")
                if sleep is not None:
                    SleepLog.objects.update_or_create(
                        day=day,
                        defaults={
                            "hours": Decimal(str(sleep["hours"])),
                            "quality": sleep["quality"],
                            "bedtime": sleep["bedtime"],
                            "wake": sleep["wake"],
                            "meds": sleep.get("meds", False),
                        },
                    )
                    sleep_count += 1

                # Nap
                nap = day_data.get("nap")
                if nap is not None:
                    NapLog.objects.update_or_create(
                        day=day,
                        defaults={
                            "hours": Decimal(str(nap["hours"])),
                            "start_time": nap["time"],
                        },
                    )
                    nap_count += 1

                # Exercise (single row per day from the JSON shape)
                exercise_cals = day_data.get("exercise") or 0
                exercise_note = day_data.get("exerciseNote", "")
                if exercise_cals or exercise_note:
                    day.exercises.all().delete()
                    ExerciseLog.objects.create(
                        day=day,
                        activity=exercise_note or "Exercise",
                        calories=int(exercise_cals),
                        position=0,
                    )
                    exercise_count += 1

        return day_count, meal_count, sleep_count, nap_count, exercise_count
