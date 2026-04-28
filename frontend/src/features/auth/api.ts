import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { clearTokens, setTokens, useAuthStore } from "@/lib/authStore";

export interface UserProfile {
  display_name: string;
  timezone: string;
  bmr: number;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  email: string;
  is_email_verified: boolean;
  date_joined: string;
  profile: UserProfile;
}

interface TokenPair {
  access: string;
  refresh: string;
}

interface RegisterResponse {
  user: User;
  tokens: TokenPair;
}

interface LoginResponse extends TokenPair {
  user: User;
}

const ME_KEY = ["me"];

export function useMe(options?: { enabled?: boolean }) {
  const refresh = useAuthStore((s) => s.refreshToken);
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => apiGet<User>("/auth/me/"),
    enabled: (options?.enabled ?? true) && Boolean(refresh),
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { email: string; password: string }) => {
      const data = await apiPost<LoginResponse>("/auth/login/", vars);
      setTokens(data.access, data.refresh);
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(ME_KEY, data.user);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      email: string;
      password: string;
      display_name?: string;
    }) => {
      const data = await apiPost<RegisterResponse>("/auth/register/", vars);
      setTokens(data.tokens.access, data.tokens.refresh);
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(ME_KEY, data.user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const refresh = useAuthStore.getState().refreshToken;
      if (refresh) {
        await apiPost("/auth/logout/", { refresh }).catch(() => {
          // ignore — we're clearing anyway
        });
      }
      clearTokens();
    },
    onSuccess: () => {
      qc.removeQueries();
    },
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: () => apiPost("/auth/verify-email/resend/"),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profile: Partial<UserProfile>) =>
      apiPatch<User>("/auth/me/", { profile }),
    onSuccess: (user) => {
      qc.setQueryData(ME_KEY, user);
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (vars: { email: string }) =>
      apiPost("/auth/password/reset/", vars),
  });
}

interface AuthConfig {
  allow_registration: boolean;
}

const AUTH_CONFIG_KEY = ["auth-config"];

export function useAuthConfig() {
  return useQuery({
    queryKey: AUTH_CONFIG_KEY,
    queryFn: () => apiGet<AuthConfig>("/auth/config/"),
    staleTime: 5 * 60 * 1000,
  });
}
