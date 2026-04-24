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

export interface DayFixture {
  id: string;
  date: string;
  meals: MealFixture[];
}

export interface TestState {
  today: string;
  timezone: string;
  foods: FoodFixture[];
  days: DayFixture[];
  nextMealId: number;
  nextDayId: number;
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
  return {
    fat_pct: (totals.fat * 9) / cals,
    sat_fat_pct: (totals.sat_fat * 9) / cals,
    carb_pct: (totals.carbs * 4) / cals,
    protein_pct: (totals.protein * 4) / cals,
    add_sugar_pct: (totals.add_sugar * 4) / cals,
  };
}

function daySummary(day: DayFixture, bmr = 1970) {
  const totals = totalsFor(day.meals);
  const macros = macrosFor(totals);
  const exercise_calories = 0;
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
    location: "SD",
    weight_lbs: null,
    creatine_mg: null,
    meals: day.meals,
    sleep: null,
    nap: null,
    exercises: [],
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
): DayFixture {
  const day: DayFixture = {
    id: `day-${state.nextDayId++}`,
    date,
    meals: [],
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
    nextMealId: 1,
    nextDayId: 1,
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
      const body = (await request.json()) as { date?: string };
      const date = body.date ?? state.today;
      const day: DayFixture = {
        id: `day-${state.nextDayId++}`,
        date,
        meals: [],
      };
      state.days.push(day);
      return HttpResponse.json(serializeDay(day), { status: 201 });
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
  ];
}
