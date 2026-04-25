import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/apiClient";

export interface Food {
  id: string;
  name: string;
  is_composite: boolean;
  has_recipe: boolean;
  calories: string;
  fat: string;
  sat_fat: string;
  cholesterol: string;
  sodium: string;
  carbs: string;
  fiber: string;
  sugar: string;
  add_sugar: string;
  protein: string;
  created_at: string;
  updated_at: string;
}

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const FOODS_KEY = ["foods"] as const;

export async function fetchAllFoods(search?: string): Promise<Food[]> {
  const all: Food[] = [];
  let page = 1;
  for (;;) {
    const resp = await apiGet<Paginated<Food>>("/foods/", {
      page,
      ...(search ? { name: search } : {}),
    });
    all.push(...resp.results);
    if (!resp.next) break;
    page += 1;
  }
  return all;
}

export function useFoods(search?: string) {
  const trimmed = search?.trim() ?? "";
  return useQuery({
    queryKey: [...FOODS_KEY, { search: trimmed }],
    queryFn: () => fetchAllFoods(trimmed || undefined),
    placeholderData: keepPreviousData,
  });
}
