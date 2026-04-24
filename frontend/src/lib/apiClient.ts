/**
 * Fetch wrapper used by orval-generated hooks and handwritten auth calls.
 *
 * Responsibilities:
 * - Attach `Authorization: Bearer <access>` from the auth store.
 * - On 401, try to refresh the access token using the refresh token, then
 *   retry the original request exactly once.
 * - On refresh failure, clear tokens and let callers see the 401.
 * - Parse JSON responses; throw with the parsed body on non-2xx.
 */

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
  useAuthStore,
} from "./authStore";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

export interface ApiErrorEntry {
  code: string;
  field: string | null;
  message: string;
}

export class ApiError extends Error {
  status: number;
  errors: ApiErrorEntry[];
  raw: unknown;

  constructor(status: number, errors: ApiErrorEntry[], raw: unknown) {
    super(errors[0]?.message ?? `HTTP ${status}`);
    this.status = status;
    this.errors = errors;
    this.raw = raw;
  }
}

// Match the `mutator` signature expected by orval's fetch client.
type OrvalConfig = {
  url: string;
  method: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  responseType?: string;
};

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = getRefreshToken();
  if (!refresh) return null;

  refreshInFlight = (async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!resp.ok) {
        clearTokens();
        return null;
      }
      const data = (await resp.json()) as { access: string; refresh?: string };
      const newRefresh = data.refresh ?? refresh;
      setTokens(data.access, newRefresh);
      return data.access;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function buildUrl(url: string, params?: Record<string, unknown>) {
  const isAbsolute = /^https?:\/\//i.test(url);
  const base = isAbsolute ? url : `${API_BASE_URL}${url}`;
  if (!params) return base;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    qs.append(k, String(v));
  }
  const suffix = qs.toString();
  return suffix ? `${base}?${suffix}` : base;
}

async function parseBody(resp: Response): Promise<unknown> {
  if (resp.status === 204 || resp.status === 205) return null;
  const ct = resp.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const text = await resp.text();
    return text ? JSON.parse(text) : null;
  }
  return resp.text();
}

async function doFetch<T>(config: OrvalConfig, attemptedRefresh: boolean): Promise<T> {
  const headers = new Headers(config.headers ?? {});
  const access = getAccessToken() ?? useAuthStore.getState().accessToken;
  if (access) headers.set("Authorization", `Bearer ${access}`);
  if (config.data !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const resp = await fetch(buildUrl(config.url, config.params), {
    method: config.method.toUpperCase(),
    headers,
    body: config.data !== undefined ? JSON.stringify(config.data) : undefined,
    signal: config.signal,
  });

  if (resp.status === 401 && !attemptedRefresh) {
    const newAccess = await refreshAccessToken();
    if (newAccess) return doFetch<T>(config, true);
  }

  const body = await parseBody(resp);

  if (!resp.ok) {
    const errors = isErrorEnvelope(body)
      ? body.errors
      : [
          {
            code: "error",
            field: null,
            message: `HTTP ${resp.status}`,
          },
        ];
    throw new ApiError(resp.status, errors, body);
  }

  return body as T;
}

function isErrorEnvelope(body: unknown): body is { errors: ApiErrorEntry[] } {
  return Boolean(
    body &&
      typeof body === "object" &&
      "errors" in body &&
      Array.isArray((body as { errors: unknown }).errors),
  );
}

export async function apiClient<T>(config: OrvalConfig): Promise<T> {
  return doFetch<T>(config, false);
}

// Convenience helpers for handwritten auth calls.
export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  return apiClient<T>({ url, method: "POST", data });
}

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return apiClient<T>({ url, method: "GET", params });
}

export async function apiPatch<T>(url: string, data?: unknown): Promise<T> {
  return apiClient<T>({ url, method: "PATCH", data });
}
