import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, apiGet, apiPost } from "@/lib/apiClient";

export interface RecipeIngredient {
  id: string;
  recipe: string;
  food: string;
  food_name: string;
  grams: string;
  note: string;
  position: number;
}

export interface Recipe {
  id: string;
  food: string;
  servings: number | null;
  total_grams_produced: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  instructions: string;
  notes: string;
  source_url: string;
  ingredients: RecipeIngredient[];
  created_at: string;
  updated_at: string;
}

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const RECIPES_KEY = ["recipes"] as const;

export function useRecipes() {
  return useQuery({
    queryKey: RECIPES_KEY,
    queryFn: async () => {
      const resp = await apiGet<Paginated<Recipe>>("/recipes/");
      return resp.results;
    },
  });
}

export interface CreateRecipeRequest {
  food: string;
  servings?: number | null;
  total_grams_produced?: string | null;
  source_url?: string;
  notes?: string;
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRecipeRequest) =>
      apiPost<Recipe>("/recipes/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECIPES_KEY });
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>({ url: `/recipes/${id}/`, method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECIPES_KEY });
    },
  });
}

export function useAddIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      recipe: string;
      food: string;
      grams: string;
      note?: string;
      position?: number;
    }) => apiPost<RecipeIngredient>("/recipe-ingredients/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECIPES_KEY });
    },
  });
}

export function useDeleteIngredient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>({ url: `/recipe-ingredients/${id}/`, method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECIPES_KEY });
    },
  });
}

export function useRecomputeRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<unknown>(`/recipes/${id}/recompute/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECIPES_KEY });
    },
  });
}
