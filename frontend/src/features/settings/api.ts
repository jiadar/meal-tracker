import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/apiClient";
import type {
  PatchedUserTargetsRequest,
  UserTargets,
} from "@/api/generated/models";

export const TARGETS_KEY = ["targets"] as const;

export function useTargets() {
  return useQuery({
    queryKey: TARGETS_KEY,
    queryFn: () => apiGet<UserTargets>("/targets/"),
  });
}

export function useUpdateTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PatchedUserTargetsRequest) =>
      apiPatch<UserTargets>("/targets/", data),
    onSuccess: (data) => {
      qc.setQueryData(TARGETS_KEY, data);
    },
  });
}
