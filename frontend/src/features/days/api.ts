import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiClient } from "@/lib/apiClient";

export interface ExerciseLog {
  id: string;
  day: string;
  activity: string;
  duration_minutes: number | null;
  calories: number;
  position?: number;
}

export interface SleepLog {
  id: string;
  day: string;
  hours: string;
  quality: number;
  bedtime: string;
  wake: string;
  meds: boolean;
}

export interface MealItem {
  id: string;
  day: string;
  food: string;
  food_name: string;
  grams: string;
  position?: number;
  nutrition: Record<string, number>;
  food_per_100g: Record<string, number>;
}

export interface DaySummary {
  totals: Record<string, number>;
  macros: {
    fat_pct: number | null;
    sat_fat_pct: number | null;
    carb_pct: number | null;
    protein_pct: number | null;
    add_sugar_pct: number | null;
  };
  bmr: number;
  exercise_calories: number;
  allowed_calories: number;
  consumed_calories: number;
  net_calories: number;
  is_surplus: boolean;
  is_deficit: boolean;
}

export interface Day {
  id: string;
  date: string;
  location: string;
  weight_lbs: string | null;
  creatine_mg: number | null;
  meals: MealItem[];
  sleep: SleepLog | null;
  nap: unknown;
  exercises: ExerciseLog[];
  summary: DaySummary;
  created_at: string;
  updated_at: string;
}

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface TodayResponse {
  date: string;
  timezone: string;
}

export const TODAY_KEY = ["today"] as const;
export const DAYS_KEY = ["days"] as const;

export function useToday() {
  return useQuery({
    queryKey: TODAY_KEY,
    queryFn: () => apiGet<TodayResponse>("/today/"),
  });
}

export function useDayByDate(date: string | undefined) {
  return useQuery({
    queryKey: [...DAYS_KEY, "by-date", date],
    queryFn: async () => {
      const resp = await apiGet<Paginated<Day>>("/days/", { from: date, to: date });
      return resp.results[0] ?? null;
    },
    enabled: Boolean(date),
  });
}

export function useCreateDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { date: string; location?: string }) =>
      apiPost<Day>("/days/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DAYS_KEY });
    },
  });
}

export interface DayPatch {
  location?: string;
  weight_lbs?: string | null;
  creatine_mg?: number | null;
}

export function useUpdateDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DayPatch }) =>
      apiPatch<Day>(`/days/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DAYS_KEY });
    },
  });
}

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      day: string;
      activity: string;
      duration_minutes?: number | null;
      calories: number;
    }) => apiPost<ExerciseLog>("/exercise-logs/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DAYS_KEY });
    },
  });
}

export function useUpdateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{ activity: string; duration_minutes: number | null; calories: number }>;
    }) => apiPatch<ExerciseLog>(`/exercise-logs/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DAYS_KEY });
    },
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>({ url: `/exercise-logs/${id}/`, method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DAYS_KEY });
    },
  });
}

export function useCreateMeal(dayId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { day: string; food: string; grams: string }) =>
      apiPost<MealItem>("/meals/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...DAYS_KEY, "by-date"] });
      if (dayId) qc.invalidateQueries({ queryKey: ["meals", dayId] });
    },
  });
}

export function useUpdateMeal(dayId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, grams }: { id: string; grams: string }) =>
      apiPatch<MealItem>(`/meals/${id}/`, { grams }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...DAYS_KEY, "by-date"] });
      if (dayId) qc.invalidateQueries({ queryKey: ["meals", dayId] });
    },
  });
}

export function useDeleteMeal(dayId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>({ url: `/meals/${id}/`, method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...DAYS_KEY, "by-date"] });
      if (dayId) qc.invalidateQueries({ queryKey: ["meals", dayId] });
    },
  });
}

export function useCreateSleep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      day: string;
      hours: string;
      quality: number;
      bedtime: string;
      wake: string;
      meds: boolean;
    }) => apiPost<SleepLog>("/sleep-logs/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DAYS_KEY });
    },
  });
}

export function useUpdateSleep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        hours: string;
        quality: number;
        bedtime: string;
        wake: string;
        meds: boolean;
      }>;
    }) => apiPatch<SleepLog>(`/sleep-logs/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DAYS_KEY });
    },
  });
}

export function useDeleteSleep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>({ url: `/sleep-logs/${id}/`, method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DAYS_KEY });
    },
  });
}
