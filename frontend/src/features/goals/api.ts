import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, apiGet, apiPatch, apiPost } from "@/lib/apiClient";

export interface WeightGoal {
  id: string;
  start_date: string;
  end_date: string;
  start_weight: string;
  goal_weight: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const GOALS_KEY = ["weight-goals"] as const;

export function useActiveGoal() {
  return useQuery({
    queryKey: GOALS_KEY,
    queryFn: async () => {
      const resp = await apiGet<Paginated<WeightGoal>>("/weight-goals/");
      const active = resp.results.filter((g) => g.active);
      if (active.length === 0) return null;
      return active.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    },
  });
}

export interface CreateGoalRequest {
  start_date: string;
  end_date: string;
  start_weight: string;
  goal_weight: string;
  active?: boolean;
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGoalRequest) =>
      apiPost<WeightGoal>("/weight-goals/", { active: true, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GOALS_KEY });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateGoalRequest> }) =>
      apiPatch<WeightGoal>(`/weight-goals/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GOALS_KEY });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>({ url: `/weight-goals/${id}/`, method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GOALS_KEY });
    },
  });
}
