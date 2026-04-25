import { http, HttpResponse } from "msw";

export const API_BASE = "http://localhost:8000/api/v1";

export interface FoodFixture {
  id: string;
  name: string;
  is_composite?: boolean;
  has_recipe?: boolean;
  calories: number;
  fat: number;
  sat_fat: number;
  cholesterol: number;
  sodium: number;
  carbs: number;
  fiber: number;
  sugar: number;
  add_sugar: number;
  protein: number;
}

export interface MealFixture {
  id: string;
  day: string;
  food: string;
  food_name: string;
  grams: string;
  position?: number;
  nutrition: Record<string, number>;
  food_per_100g: Record<string, number>;
}

export interface ExerciseFixture {
  id: string;
  day: string;
  activity: string;
  duration_minutes: number | null;
  calories: number;
  position: number;
}

export interface SleepFixture {
  id: string;
  day: string;
  hours: string;
  quality: number;
  bedtime: string;
  wake: string;
  meds: boolean;
}

export interface NapFixture {
  id: string;
  day: string;
  hours: string;
  start_time: string;
}

export interface DayFixture {
  id: string;
  date: string;
  location: string;
  weight_lbs: string | null;
  creatine_mg: number | null;
  meals: MealFixture[];
  exercises: ExerciseFixture[];
  sleep: SleepFixture | null;
  nap: NapFixture | null;
}

export interface TargetsFixture {
  id: string;
  fat_pct_low: string;
  fat_pct_high: string;
  sat_fat_pct_low: string;
  sat_fat_pct_high: string;
  carb_pct_low: string;
  carb_pct_high: string;
  protein_pct_low: string;
  protein_pct_high: string;
  added_sugar_pct_low: string;
  added_sugar_pct_high: string;
  cholesterol_low: string;
  cholesterol_high: string;
  sodium_low: string;
  sodium_high: string;
  fiber_low: string;
  fiber_high: string;
  protein_min: string;
  creatine_min: string;
  sleep_hours_low: string;
  sleep_hours_high: string;
  sleep_quality_low: number;
  sleep_quality_high: number;
  created_at: string;
  updated_at: string;
}

export function defaultTargets(): TargetsFixture {
  return {
    id: "targets-1",
    fat_pct_low: "20.00",
    fat_pct_high: "35.00",
    sat_fat_pct_low: "0.00",
    sat_fat_pct_high: "10.00",
    carb_pct_low: "45.00",
    carb_pct_high: "65.00",
    protein_pct_low: "10.00",
    protein_pct_high: "35.00",
    added_sugar_pct_low: "0.00",
    added_sugar_pct_high: "10.00",
    cholesterol_low: "0.0",
    cholesterol_high: "200.0",
    sodium_low: "0.0",
    sodium_high: "2300.0",
    fiber_low: "28.0",
    fiber_high: "34.0",
    protein_min: "90.0",
    creatine_min: "5.0",
    sleep_hours_low: "8.00",
    sleep_hours_high: "10.00",
    sleep_quality_low: 4,
    sleep_quality_high: 5,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

export interface TestState {
  today: string;
  timezone: string;
  foods: FoodFixture[];
  days: DayFixture[];
  targets: TargetsFixture;
  nextMealId: number;
  nextDayId: number;
  nextExerciseId: number;
  nextSleepId: number;
}

const DEFAULT_FOOD: Omit<FoodFixture, "id" | "name" | "calories"> = {
  is_composite: false,
  has_recipe: false,
  fat: 0,
  sat_fat: 0,
  cholesterol: 0,
  sodium: 0,
  carbs: 0,
  fiber: 0,
  sugar: 0,
  add_sugar: 0,
  protein: 0,
};

export function makeFood(partial: Partial<FoodFixture> & { id: string; name: string; calories: number }): FoodFixture {
  return { ...DEFAULT_FOOD, ...partial };
}

export function foodPer100g(f: FoodFixture) {
  return {
    calories: f.calories,
    fat: f.fat,
    sat_fat: f.sat_fat,
    cholesterol: f.cholesterol,
    sodium: f.sodium,
    carbs: f.carbs,
    fiber: f.fiber,
    sugar: f.sugar,
    add_sugar: f.add_sugar,
    protein: f.protein,
  };
}

function nutritionFor(food: FoodFixture, grams: number) {
  const factor = grams / 100;
  const per = foodPer100g(food);
  return Object.fromEntries(
    Object.entries(per).map(([k, v]) => [k, Number((v * factor).toFixed(4))]),
  );
}

function totalsFor(meals: MealFixture[]) {
  const keys = [
    "calories", "fat", "sat_fat", "cholesterol", "sodium",
    "carbs", "fiber", "sugar", "add_sugar", "protein",
  ] as const;
  const totals: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const m of meals) {
    for (const k of keys) totals[k] += m.nutrition[k] ?? 0;
  }
  return totals;
}

function macrosFor(totals: Record<string, number>) {
  const cals = totals.calories;
  if (!cals) return { fat_pct: null, sat_fat_pct: null, carb_pct: null, protein_pct: null, add_sugar_pct: null };
  // Whole-number percentages, matching backend macro_percentages().
  return {
    fat_pct: Number((((totals.fat * 9) / cals) * 100).toFixed(1)),
    sat_fat_pct: Number((((totals.sat_fat * 9) / cals) * 100).toFixed(1)),
    carb_pct: Number((((totals.carbs * 4) / cals) * 100).toFixed(1)),
    protein_pct: Number((((totals.protein * 4) / cals) * 100).toFixed(1)),
    add_sugar_pct: Number((((totals.add_sugar * 4) / cals) * 100).toFixed(1)),
  };
}

function daySummary(day: DayFixture, bmr = 1970) {
  const totals = totalsFor(day.meals);
  const macros = macrosFor(totals);
  const exercise_calories = day.exercises.reduce((a, e) => a + e.calories, 0);
  const allowed = bmr + exercise_calories;
  const consumed = totals.calories;
  const net = consumed - allowed;
  return {
    totals,
    macros,
    bmr,
    exercise_calories,
    allowed_calories: allowed,
    consumed_calories: consumed,
    net_calories: Number(net.toFixed(2)),
    is_surplus: net > 0,
    is_deficit: net < 0,
  };
}

function serializeDay(day: DayFixture) {
  return {
    id: day.id,
    date: day.date,
    location: day.location,
    weight_lbs: day.weight_lbs,
    creatine_mg: day.creatine_mg,
    meals: day.meals,
    sleep: day.sleep,
    nap: day.nap,
    exercises: day.exercises,
    summary: daySummary(day),
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function paginated<T>(results: T[]) {
  return { count: results.length, next: null, previous: null, results };
}

export function seedDay(
  state: TestState,
  date: string,
  meals: Array<{ foodId: string; grams: number }>,
  overrides: Partial<Pick<DayFixture, "location" | "weight_lbs" | "creatine_mg">> = {},
): DayFixture {
  const day: DayFixture = {
    id: `day-${state.nextDayId++}`,
    date,
    location: overrides.location ?? "SD",
    weight_lbs: overrides.weight_lbs ?? null,
    creatine_mg: overrides.creatine_mg ?? null,
    meals: [],
    exercises: [],
    sleep: null,
    nap: null,
  };
  for (const { foodId, grams } of meals) {
    const food = state.foods.find((f) => f.id === foodId);
    if (!food) throw new Error(`seedDay: unknown food id ${foodId}`);
    day.meals.push({
      id: `meal-${state.nextMealId++}`,
      day: day.id,
      food: food.id,
      food_name: food.name,
      grams: grams.toFixed(2),
      position: day.meals.length,
      nutrition: nutritionFor(food, grams),
      food_per_100g: foodPer100g(food),
    });
  }
  state.days.push(day);
  return day;
}

export function createTestState(overrides: Partial<TestState> = {}): TestState {
  return {
    today: "2026-04-23",
    timezone: "America/Los_Angeles",
    foods: [],
    days: [],
    targets: defaultTargets(),
    nextMealId: 1,
    nextDayId: 1,
    nextExerciseId: 1,
    nextSleepId: 1,
    ...overrides,
  };
}

export function buildHandlers(state: TestState) {
  return [
    http.get(`${API_BASE}/today/`, () =>
      HttpResponse.json({ date: state.today, timezone: state.timezone }),
    ),

    http.get(`${API_BASE}/foods/`, ({ request }) => {
      const url = new URL(request.url);
      const name = url.searchParams.get("name")?.toLowerCase();
      const filtered = name
        ? state.foods.filter((f) => f.name.toLowerCase().includes(name))
        : state.foods;
      return HttpResponse.json(paginated(filtered));
    }),

    http.get(`${API_BASE}/days/`, ({ request }) => {
      const url = new URL(request.url);
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      let days = state.days;
      if (from) days = days.filter((d) => d.date >= from);
      if (to) days = days.filter((d) => d.date <= to);
      return HttpResponse.json(paginated(days.map(serializeDay)));
    }),

    http.post(`${API_BASE}/days/`, async ({ request }) => {
      const body = (await request.json()) as { date?: string; location?: string };
      const date = body.date ?? state.today;
      const day: DayFixture = {
        id: `day-${state.nextDayId++}`,
        date,
        location: body.location ?? "SD",
        weight_lbs: null,
        creatine_mg: null,
        meals: [],
        exercises: [],
        sleep: null,
        nap: null,
      };
      state.days.push(day);
      return HttpResponse.json(serializeDay(day), { status: 201 });
    }),

    http.patch(`${API_BASE}/days/:id/`, async ({ request, params }) => {
      const body = (await request.json()) as Partial<{
        location: string;
        weight_lbs: string | null;
        creatine_mg: number | null;
      }>;
      const day = state.days.find((d) => d.id === params.id);
      if (!day) return HttpResponse.json({ detail: "not found" }, { status: 404 });
      if (body.location !== undefined) day.location = body.location;
      if (body.weight_lbs !== undefined) day.weight_lbs = body.weight_lbs;
      if (body.creatine_mg !== undefined) day.creatine_mg = body.creatine_mg;
      return HttpResponse.json(serializeDay(day));
    }),

    http.post(`${API_BASE}/meals/`, async ({ request }) => {
      const body = (await request.json()) as { day: string; food: string; grams: string };
      const day = state.days.find((d) => d.id === body.day);
      const food = state.foods.find((f) => f.id === body.food);
      if (!day || !food) return HttpResponse.json({ detail: "not found" }, { status: 404 });
      const grams = Number(body.grams);
      const meal: MealFixture = {
        id: `meal-${state.nextMealId++}`,
        day: day.id,
        food: food.id,
        food_name: food.name,
        grams: body.grams,
        position: day.meals.length,
        nutrition: nutritionFor(food, grams),
        food_per_100g: foodPer100g(food),
      };
      day.meals.push(meal);
      return HttpResponse.json(meal, { status: 201 });
    }),

    http.patch(`${API_BASE}/meals/:id/`, async ({ request, params }) => {
      const body = (await request.json()) as { grams?: string };
      for (const day of state.days) {
        const meal = day.meals.find((m) => m.id === params.id);
        if (!meal) continue;
        if (body.grams != null) {
          meal.grams = body.grams;
          const food = state.foods.find((f) => f.id === meal.food)!;
          meal.nutrition = nutritionFor(food, Number(body.grams));
        }
        return HttpResponse.json(meal);
      }
      return HttpResponse.json({ detail: "not found" }, { status: 404 });
    }),

    http.delete(`${API_BASE}/meals/:id/`, ({ params }) => {
      for (const day of state.days) {
        const idx = day.meals.findIndex((m) => m.id === params.id);
        if (idx >= 0) {
          day.meals.splice(idx, 1);
          return new HttpResponse(null, { status: 204 });
        }
      }
      return HttpResponse.json({ detail: "not found" }, { status: 404 });
    }),

    http.get(`${API_BASE}/exercise-logs/`, ({ request }) => {
      const url = new URL(request.url);
      const dayId = url.searchParams.get("day");
      const all = state.days.flatMap((d) => d.exercises);
      const filtered = dayId ? all.filter((e) => e.day === dayId) : all;
      return HttpResponse.json(paginated(filtered));
    }),

    http.post(`${API_BASE}/exercise-logs/`, async ({ request }) => {
      const body = (await request.json()) as {
        day: string;
        activity: string;
        duration_minutes?: number | null;
        calories: number;
      };
      const day = state.days.find((d) => d.id === body.day);
      if (!day) return HttpResponse.json({ detail: "not found" }, { status: 404 });
      const log: ExerciseFixture = {
        id: `ex-${state.nextExerciseId++}`,
        day: day.id,
        activity: body.activity,
        duration_minutes: body.duration_minutes ?? null,
        calories: body.calories,
        position: day.exercises.length,
      };
      day.exercises.push(log);
      return HttpResponse.json(log, { status: 201 });
    }),

    http.patch(`${API_BASE}/exercise-logs/:id/`, async ({ request, params }) => {
      const body = (await request.json()) as Partial<{
        activity: string;
        duration_minutes: number | null;
        calories: number;
      }>;
      for (const day of state.days) {
        const log = day.exercises.find((e) => e.id === params.id);
        if (!log) continue;
        if (body.activity !== undefined) log.activity = body.activity;
        if (body.duration_minutes !== undefined) log.duration_minutes = body.duration_minutes;
        if (body.calories !== undefined) log.calories = body.calories;
        return HttpResponse.json(log);
      }
      return HttpResponse.json({ detail: "not found" }, { status: 404 });
    }),

    http.delete(`${API_BASE}/exercise-logs/:id/`, ({ params }) => {
      for (const day of state.days) {
        const idx = day.exercises.findIndex((e) => e.id === params.id);
        if (idx >= 0) {
          day.exercises.splice(idx, 1);
          return new HttpResponse(null, { status: 204 });
        }
      }
      return HttpResponse.json({ detail: "not found" }, { status: 404 });
    }),

    http.post(`${API_BASE}/sleep-logs/`, async ({ request }) => {
      const body = (await request.json()) as {
        day: string;
        hours: string;
        quality: number;
        bedtime: string;
        wake: string;
        meds?: boolean;
      };
      const day = state.days.find((d) => d.id === body.day);
      if (!day) return HttpResponse.json({ detail: "not found" }, { status: 404 });
      if (day.sleep) {
        return HttpResponse.json(
          { detail: "Day already has a sleep log." },
          { status: 400 },
        );
      }
      const log: SleepFixture = {
        id: `sleep-${state.nextSleepId++}`,
        day: day.id,
        hours: body.hours,
        quality: body.quality,
        bedtime: body.bedtime,
        wake: body.wake,
        meds: body.meds ?? false,
      };
      day.sleep = log;
      return HttpResponse.json(log, { status: 201 });
    }),

    http.patch(`${API_BASE}/sleep-logs/:id/`, async ({ request, params }) => {
      const body = (await request.json()) as Partial<{
        hours: string;
        quality: number;
        bedtime: string;
        wake: string;
        meds: boolean;
      }>;
      for (const day of state.days) {
        if (day.sleep?.id !== params.id) continue;
        if (body.hours !== undefined) day.sleep.hours = body.hours;
        if (body.quality !== undefined) day.sleep.quality = body.quality;
        if (body.bedtime !== undefined) day.sleep.bedtime = body.bedtime;
        if (body.wake !== undefined) day.sleep.wake = body.wake;
        if (body.meds !== undefined) day.sleep.meds = body.meds;
        return HttpResponse.json(day.sleep);
      }
      return HttpResponse.json({ detail: "not found" }, { status: 404 });
    }),

    http.delete(`${API_BASE}/sleep-logs/:id/`, ({ params }) => {
      for (const day of state.days) {
        if (day.sleep?.id === params.id) {
          day.sleep = null;
          return new HttpResponse(null, { status: 204 });
        }
      }
      return HttpResponse.json({ detail: "not found" }, { status: 404 });
    }),

    http.get(`${API_BASE}/months/:year-:month/summary/`, ({ params }) => {
      const year = Number(params.year);
      const month = Number(params.month);
      const prefix = `${year}-${String(month).padStart(2, "0")}-`;
      const monthDays = state.days.filter((d) => d.date.startsWith(prefix));
      const n = monthDays.length;

      // Sum nutrient totals across all meals in the month.
      const summed: Record<string, number> = {
        calories: 0, fat: 0, sat_fat: 0, cholesterol: 0, sodium: 0,
        carbs: 0, fiber: 0, sugar: 0, add_sugar: 0, protein: 0,
      };
      for (const d of monthDays) {
        const t = totalsFor(d.meals);
        for (const k of Object.keys(summed)) summed[k] += t[k] ?? 0;
      }
      const averages = n
        ? Object.fromEntries(
            Object.entries(summed).map(([k, v]) => [k, Number((v / n).toFixed(2))]),
          )
        : {};
      const macros = macrosFor(summed);

      const totalExercise = monthDays.reduce(
        (a, d) => a + d.exercises.reduce((b, e) => b + e.calories, 0),
        0,
      );
      const consumed = summed.calories;
      const allowed = n * 1970 + totalExercise;
      const net = consumed - allowed;

      const weightDays = monthDays.filter((d) => d.weight_lbs != null);
      const weights = weightDays
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => Number(d.weight_lbs));
      const weight = weights.length
        ? {
            start: weights[0],
            end: weights[weights.length - 1],
            change: Number((weights[0] - weights[weights.length - 1]).toFixed(2)),
            low: Math.min(...weights),
            high: Math.max(...weights),
            days_with_data: weights.length,
          }
        : null;

      const sleepDays = monthDays.filter((d) => d.sleep != null);
      const sleep = sleepDays.length
        ? {
            days_with_data: sleepDays.length,
            avg_hours: Number(
              (
                sleepDays.reduce((a, d) => a + Number(d.sleep!.hours), 0) /
                sleepDays.length
              ).toFixed(2),
            ),
            avg_quality: Number(
              (
                sleepDays.reduce((a, d) => a + d.sleep!.quality, 0) /
                sleepDays.length
              ).toFixed(2),
            ),
          }
        : null;

      const creatineDays = monthDays.filter((d) => d.creatine_mg != null);
      const creatine_avg_mg = creatineDays.length
        ? Number(
            (
              creatineDays.reduce((a, d) => a + (d.creatine_mg ?? 0), 0) /
              creatineDays.length
            ).toFixed(2),
          )
        : null;

      return HttpResponse.json({
        year,
        month,
        days_tracked: n,
        averages,
        macros,
        totals: {
          consumed_calories: Number(consumed.toFixed(2)),
          exercise_calories: totalExercise,
          allowed_calories: allowed,
          net_calories: Number(net.toFixed(2)),
          is_surplus: net > 0,
        },
        creatine_avg_mg,
        weight,
        sleep,
      });
    }),

    http.get(`${API_BASE}/targets/`, () => HttpResponse.json(state.targets)),

    http.patch(`${API_BASE}/targets/`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      Object.assign(state.targets, body);
      state.targets.updated_at = new Date().toISOString();
      return HttpResponse.json(state.targets);
    }),
  ];
}
