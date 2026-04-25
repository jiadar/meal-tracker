import { trimSeconds } from "./time";
import type { Day } from "@/features/days/api";
import type { Food } from "@/features/foods/api";

const MONTH_PREFIX = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

const NUTRIENT_FIELDS = [
  "calories", "fat", "sat_fat", "cholesterol", "sodium",
  "carbs", "fiber", "sugar", "add_sugar", "protein",
] as const;

const SPEC_KEY: Record<(typeof NUTRIENT_FIELDS)[number], string> = {
  calories: "calories",
  fat: "fat",
  sat_fat: "satFat",
  cholesterol: "cholesterol",
  sodium: "sodium",
  carbs: "carbs",
  fiber: "fiber",
  sugar: "sugar",
  add_sugar: "addSugar",
  protein: "protein",
};

function mapNutrients(food: Food): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of NUTRIENT_FIELDS) {
    out[SPEC_KEY[k]] = Number(food[k]);
  }
  return out;
}

function monthIdOf(iso: string): string {
  const year = iso.slice(0, 4);
  const month = Number(iso.slice(5, 7));
  return `${MONTH_PREFIX[month - 1]}${year}`;
}

function monthLabelOf(iso: string): string {
  const year = iso.slice(0, 4);
  const month = Number(iso.slice(5, 7));
  const prefix = MONTH_PREFIX[month - 1];
  return `${prefix.charAt(0).toUpperCase()}${prefix.slice(1)} ${year}`;
}

export interface ExportShape {
  foodDatabase: Record<string, Record<string, number>>;
  foodIds: Record<string, number>;
  months: Record<
    string,
    {
      label: string;
      days: Record<string, ExportDay>;
    }
  >;
}

interface ExportDay {
  location: string;
  weight: number | null;
  exercise: number;
  exerciseNote: string;
  creatine: number | null;
  sleep?: {
    hours: number;
    quality: number;
    bedtime: string;
    wake: string;
    meds: boolean;
  };
  nap?: {
    hours: number;
    time: string;
  };
  meals: { item: string; grams: number }[];
}

export function buildExport(days: Day[], foods: Food[]): ExportShape {
  const sortedFoods = [...foods].sort((a, b) => a.name.localeCompare(b.name));
  const foodDatabase: Record<string, Record<string, number>> = {};
  const foodIds: Record<string, number> = {};
  for (let i = 0; i < sortedFoods.length; i += 1) {
    const f = sortedFoods[i];
    foodDatabase[f.name] = mapNutrients(f);
    foodIds[f.name] = i + 1;
  }

  const months: ExportShape["months"] = {};
  for (const d of days) {
    const monthId = monthIdOf(d.date);
    if (!months[monthId]) {
      months[monthId] = { label: monthLabelOf(d.date), days: {} };
    }
    const dayNum = String(Number(d.date.slice(8, 10)));
    const exercise = d.exercises[0];
    const day: ExportDay = {
      location: d.location || "SD",
      weight: d.weight_lbs != null ? Number(d.weight_lbs) : null,
      exercise: exercise?.calories ?? 0,
      exerciseNote: exercise?.activity ?? "",
      creatine: d.creatine_mg ?? null,
      meals: d.meals.map((m) => ({
        item: m.food_name,
        grams: Number(m.grams),
      })),
    };
    if (d.sleep) {
      day.sleep = {
        hours: Number(d.sleep.hours),
        quality: d.sleep.quality,
        bedtime: trimSeconds(d.sleep.bedtime),
        wake: trimSeconds(d.sleep.wake),
        meds: d.sleep.meds,
      };
    }
    if (d.nap) {
      day.nap = {
        hours: Number(d.nap.hours),
        time: trimSeconds(d.nap.start_time),
      };
    }
    months[monthId].days[dayNum] = day;
  }

  return { foodDatabase, foodIds, months };
}
