import { create } from "zustand";

const REFRESH_KEY = "meal-tracker.refresh";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (access: string, refresh: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: localStorage.getItem(REFRESH_KEY),
  setTokens: (access, refresh) => {
    localStorage.setItem(REFRESH_KEY, refresh);
    set({ accessToken: access, refreshToken: refresh });
  },
  clear: () => {
    localStorage.removeItem(REFRESH_KEY);
    set({ accessToken: null, refreshToken: null });
  },
}));

export function getAccessToken() {
  return useAuthStore.getState().accessToken;
}

export function getRefreshToken() {
  return useAuthStore.getState().refreshToken;
}

export function setTokens(access: string, refresh: string) {
  useAuthStore.getState().setTokens(access, refresh);
}

export function clearTokens() {
  useAuthStore.getState().clear();
}

export function isAuthenticated() {
  return Boolean(useAuthStore.getState().refreshToken);
}
