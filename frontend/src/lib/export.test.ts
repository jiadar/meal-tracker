import { describe, expect, it } from "vitest";
import { buildExport } from "./export";
import type { Day } from "@/features/days/api";
import type { Food } from "@/features/foods/api";

function makeFood(name: string, partial: Partial<Food> = {}): Food {
  return {
    id: `food-${name}`,
    name,
    is_composite: false,
    has_recipe: false,
    calories: "100",
    fat: "0",
    sat_fat: "0",
    cholesterol: "0",
    sodium: "0",
    carbs: "0",
    fiber: "0",
    sugar: "0",
    add_sugar: "0",
    protein: "0",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

function makeDay(partial: Partial<Day> & { date: string; id: string }): Day {
  return {
    location: "SD",
    weight_lbs: null,
    creatine_mg: null,
    meals: [],
    sleep: null,
    nap: null,
    exercises: [],
    summary: {
      totals: {},
      macros: {
        fat_pct: null,
        sat_fat_pct: null,
        carb_pct: null,
        protein_pct: null,
        add_sugar_pct: null,
      },
      bmr: 1970,
      exercise_calories: 0,
      allowed_calories: 1970,
      consumed_calories: 0,
      net_calories: -1970,
      is_surplus: false,
      is_deficit: true,
    },
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    ...partial,
  };
}

describe("buildExport", () => {
  it("alphabetizes foodDatabase and assigns 1-indexed foodIds", () => {
    const foods: Food[] = [
      makeFood("Banana", { calories: "89", protein: "1.1" }),
      makeFood("Almond Butter", { calories: "614", fat: "55.5" }),
      makeFood("Cottage Cheese", { calories: "72" }),
    ];
    const out = buildExport([], foods);

    expect(Object.keys(out.foodDatabase)).toEqual([
      "Almond Butter",
      "Banana",
      "Cottage Cheese",
    ]);
    expect(out.foodIds).toEqual({
      "Almond Butter": 1,
      Banana: 2,
      "Cottage Cheese": 3,
    });
    // Spec uses camelCase: satFat, addSugar.
    expect(out.foodDatabase["Almond Butter"]).toMatchObject({
      calories: 614,
      fat: 55.5,
      satFat: 0,
      addSugar: 0,
      protein: 0,
    });
  });

  it("groups days by year-month and shapes each day per spec", () => {
    const foods: Food[] = [makeFood("Egg")];
    const days: Day[] = [
      makeDay({
        id: "d1",
        date: "2026-04-15",
        location: "NOLA",
        weight_lbs: "167.4",
        creatine_mg: 5,
        meals: [
          {
            id: "m1",
            day: "d1",
            food: "food-Egg",
            food_name: "Egg",
            grams: "50.00",
            nutrition: {},
            food_per_100g: {},
          },
        ],
        exercises: [
          {
            id: "e1",
            day: "d1",
            activity: "Jiu Jitsu",
            duration_minutes: 60,
            calories: 600,
          },
        ],
        sleep: {
          id: "s1",
          day: "d1",
          hours: "7.50",
          quality: 4,
          bedtime: "22:10:00",
          wake: "05:55:00",
          meds: true,
        },
        nap: {
          id: "n1",
          day: "d1",
          hours: "1.00",
          start_time: "15:00:00",
        },
      }),
      makeDay({ id: "d2", date: "2025-10-20", location: "SD" }),
    ];

    const out = buildExport(days, foods);

    expect(Object.keys(out.months).sort()).toEqual(["apr2026", "oct2025"]);
    expect(out.months.apr2026.label).toBe("Apr 2026");
    expect(out.months.oct2025.label).toBe("Oct 2025");

    const apr15 = out.months.apr2026.days["15"];
    expect(apr15).toMatchObject({
      location: "NOLA",
      weight: 167.4,
      exercise: 600,
      exerciseNote: "Jiu Jitsu",
      creatine: 5,
      sleep: {
        hours: 7.5,
        quality: 4,
        bedtime: "22:10",
        wake: "05:55",
        meds: true,
      },
      nap: { hours: 1, time: "15:00" },
      meals: [{ item: "Egg", grams: 50 }],
    });
  });

  it("omits sleep and nap when not present", () => {
    const out = buildExport(
      [makeDay({ id: "d", date: "2026-04-05" })],
      [],
    );
    const day = out.months.apr2026.days["5"];
    expect(day.sleep).toBeUndefined();
    expect(day.nap).toBeUndefined();
    expect(day.exercise).toBe(0);
    expect(day.exerciseNote).toBe("");
  });
});
