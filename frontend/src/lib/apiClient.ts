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

// Internal call config used by `doFetch`. Hand-rolled callers (apiGet /
// apiPost / apiPatch) pass `data` to be JSON-stringified; orval's fetch
// httpClient passes `body` already stringified plus `headers`/`signal` via
// a RequestInit-style second argument.
type RequestConfig = {
  url: string;
  method: string;
  params?: Record<string, unknown>;
  data?: unknown;
  body?: BodyInit | null;
  headers?: HeadersInit;
  signal?: AbortSignal | null;
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
  let path = url;
  // Orval emits absolute paths like `/api/v1/targets/`. API_BASE_URL already
  // includes the `/api/v1` prefix, so strip it to avoid doubling up. Hand-
  // rolled callers pass relative paths like `/targets/` and skip this.
  if (!isAbsolute && path.startsWith("/api/v1/")) {
    path = path.slice("/api/v1".length);
  }
  const base = isAbsolute ? url : `${API_BASE_URL}${path}`;
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

async function doFetch<T>(config: RequestConfig, attemptedRefresh: boolean): Promise<T> {
  const headers = new Headers(config.headers ?? {});
  const access = getAccessToken() ?? useAuthStore.getState().accessToken;
  if (access) headers.set("Authorization", `Bearer ${access}`);
  if (config.data !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const requestBody =
    config.body !== undefined
      ? config.body
      : config.data !== undefined
        ? JSON.stringify(config.data)
        : undefined;

  const resp = await fetch(buildUrl(config.url, config.params), {
    method: config.method.toUpperCase(),
    headers,
    body: requestBody,
    signal: config.signal ?? undefined,
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

/**
 * Dual-form API client.
 *
 * - Hand-rolled callers pass a single `RequestConfig` object:
 *   `apiClient({ url, method, data })`.
 * - Orval-generated hooks (httpClient: "fetch") call it as a fetch-style
 *   mutator: `apiClient(url, { method, headers, body })`.
 */
export async function apiClient<T>(config: RequestConfig): Promise<T>;
export async function apiClient<T>(url: string, init?: RequestInit): Promise<T>;
export async function apiClient<T>(
  urlOrConfig: string | RequestConfig,
  init?: RequestInit,
): Promise<T> {
  if (typeof urlOrConfig === "string") {
    return doFetch<T>(
      {
        url: urlOrConfig,
        method: init?.method ?? "GET",
        headers: init?.headers,
        body: init?.body ?? undefined,
        signal: init?.signal,
      },
      false,
    );
  }
  return doFetch<T>(urlOrConfig, false);
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
