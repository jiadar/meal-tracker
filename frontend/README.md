# Meal Tracker Frontend

React + TypeScript SPA that talks to the Django backend in `../backend/`.

## Stack

- Vite + React 19 + TypeScript
- React Router v7
- TanStack Query v5
- Mantine v9 (`@mantine/core`, `form`, `dates`, `charts`, `notifications`, `hooks`)
- Zustand for the auth store
- orval — generates typed React Query hooks from the backend's OpenAPI schema
- ESLint + Prettier, pnpm

## Running

The backend must be running on `http://localhost:8000` (see `../backend/README.md`).

```bash
pnpm install
pnpm generate:api   # generates typed hooks from http://localhost:8000/api/v1/schema/
pnpm dev            # Vite on http://localhost:5173
```

## Structure

```
src/
  api/generated/       — orval-generated React Query hooks + types
  components/          — AppShell, ProtectedRoute, Placeholder
  features/
    auth/              — Login, Register, VerifyPending, ResetPassword + api.ts
    onboarding/        — OnboardingPage (3-step wizard)
    days/              — DayDetailPage
  lib/
    apiClient.ts       — fetch wrapper: JWT, auto-refresh on 401, error envelope parsing
    authStore.ts       — Zustand store: access in memory, refresh in localStorage
    queryClient.ts     — React Query defaults
    theme.ts           — Mantine theme (dark, matches features.md §8.1 palette)
  routes/
    routes.tsx         — React Router config
  main.tsx             — app entry
  index.css            — fonts + base styles
```

## Auth flow

- `/login`, `/register`, `/reset-password` — public
- After register → `/verify-pending` until the email is verified (backend blocks all domain APIs with 403 until verified)
- After verification + first login → `/onboarding` until `profile.onboarded_at` is set
- Then the main app: Day Detail, Month, Foods, Recipes, Weight, Sleep, Goals, Settings

Access tokens live in memory. Refresh tokens live in `localStorage`. The fetch wrapper auto-refreshes on 401 and retries the original request once.

## Regenerating API types

After the backend schema changes:

```bash
pnpm generate:api
```

Writes to `src/api/generated/` — types, query keys, and mutation hooks derived from the running backend.
