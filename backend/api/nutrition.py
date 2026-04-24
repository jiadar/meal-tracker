from decimal import Decimal
from statistics import mean

from .models import NUTRIENT_FIELDS


def zero_nutrients() -> dict:
    return {field: Decimal("0") for field in NUTRIENT_FIELDS}


def nutrients_for_meal(meal) -> dict:
    """Compute absolute nutrient values for a Meal: per100g * grams / 100."""
    factor = meal.grams / Decimal("100")
    return {
        field: (getattr(meal.food, field) * factor).quantize(Decimal("0.01"))
        for field in NUTRIENT_FIELDS
    }


def day_totals(day) -> dict:
    totals = zero_nutrients()
    for meal in day.meals.all():
        factor = meal.grams / Decimal("100")
        for field in NUTRIENT_FIELDS:
            totals[field] += getattr(meal.food, field) * factor
    for field in totals:
        totals[field] = totals[field].quantize(Decimal("0.01"))
    return totals


def macro_percentages(totals: dict) -> dict:
    cal = totals["calories"]
    if cal <= 0:
        return {k: None for k in ("fat_pct", "sat_fat_pct", "carb_pct", "protein_pct", "add_sugar_pct")}
    return {
        "fat_pct": (totals["fat"] * Decimal("9") / cal * Decimal("100")).quantize(Decimal("0.1")),
        "sat_fat_pct": (totals["sat_fat"] * Decimal("9") / cal * Decimal("100")).quantize(Decimal("0.1")),
        "carb_pct": (totals["carbs"] * Decimal("4") / cal * Decimal("100")).quantize(Decimal("0.1")),
        "protein_pct": (totals["protein"] * Decimal("4") / cal * Decimal("100")).quantize(Decimal("0.1")),
        "add_sugar_pct": (totals["add_sugar"] * Decimal("4") / cal * Decimal("100")).quantize(Decimal("0.1")),
    }


def month_summary(days_qs, bmr: int) -> dict:
    """Aggregate stats across a queryset of Day rows."""
    days = list(days_qs.prefetch_related("meals__food", "exercises").select_related("sleep", "nap"))
    n = len(days)
    if n == 0:
        return {
            "days_tracked": 0,
            "averages": {},
            "macros": {},
            "totals": {},
            "weight": None,
            "sleep": None,
        }

    summed = zero_nutrients()
    total_exercise = 0
    total_consumed = Decimal("0")
    total_allowed = 0
    for day in days:
        dt = day_totals(day)
        for field in NUTRIENT_FIELDS:
            summed[field] += dt[field]
        ex = sum((e.calories for e in day.exercises.all()), 0)
        total_exercise += ex
        total_consumed += dt["calories"]
        total_allowed += bmr + ex

    averages = {k: float((v / n).quantize(Decimal("0.01"))) for k, v in summed.items()}
    macros = macro_percentages(summed)  # computed from totals then stays proportional

    # Weight tracking
    weight_days = [d for d in days if d.weight_lbs is not None]
    weight = None
    if weight_days:
        weight_days.sort(key=lambda d: d.date)
        weights = [float(d.weight_lbs) for d in weight_days]
        weight = {
            "start": weights[0],
            "end": weights[-1],
            "change": round(weights[0] - weights[-1], 2),  # positive = weight lost
            "low": min(weights),
            "high": max(weights),
            "days_with_data": len(weight_days),
        }

    # Sleep tracking
    sleep_days = [d for d in days if hasattr(d, "sleep") and d.sleep is not None]
    sleep = None
    if sleep_days:
        sleep = {
            "days_with_data": len(sleep_days),
            "avg_hours": round(mean(float(d.sleep.hours) for d in sleep_days), 2),
            "avg_quality": round(mean(d.sleep.quality for d in sleep_days), 2),
        }

    creatine_days = [d for d in days if d.creatine_mg is not None]
    avg_creatine = round(mean(d.creatine_mg for d in creatine_days), 2) if creatine_days else None

    total_net = float(total_consumed) - total_allowed

    return {
        "days_tracked": n,
        "averages": averages,
        "macros": {k: (None if v is None else float(v)) for k, v in macros.items()},
        "totals": {
            "consumed_calories": float(total_consumed),
            "exercise_calories": total_exercise,
            "allowed_calories": total_allowed,
            "net_calories": round(total_net, 2),
            "is_surplus": total_net > 0,
        },
        "creatine_avg_mg": avg_creatine,
        "weight": weight,
        "sleep": sleep,
    }


def day_summary(day, bmr: int) -> dict:
    totals = day_totals(day)
    pcts = macro_percentages(totals)
    exercise_calories = sum((e.calories for e in day.exercises.all()), 0)
    allowed = bmr + exercise_calories
    consumed = float(totals["calories"])
    net = consumed - allowed  # positive = surplus, negative = deficit

    return {
        "totals": {k: float(v) for k, v in totals.items()},
        "macros": {k: (None if v is None else float(v)) for k, v in pcts.items()},
        "bmr": bmr,
        "exercise_calories": exercise_calories,
        "allowed_calories": allowed,
        "consumed_calories": float(totals["calories"]),
        "net_calories": round(net, 2),
        "is_surplus": net > 0,
        "is_deficit": net < 0,
    }
