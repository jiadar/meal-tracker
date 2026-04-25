import type { ReactElement, ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { theme } from "@/lib/theme";
import { useAuthStore } from "@/lib/authStore";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

interface Options extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
}

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { queryClient = makeQueryClient(), ...rest } = options;

  // Auth-gated hooks like `useMe` only fire when a refresh token is present.
  // Seed a stub here so tests don't have to wire auth state per-test.
  if (!useAuthStore.getState().refreshToken) {
    useAuthStore.setState({ accessToken: "test-access", refreshToken: "test-refresh" });
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MantineProvider theme={theme} defaultColorScheme="light" env="test">
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{children}</MemoryRouter>
          <Notifications />
        </QueryClientProvider>
      </MantineProvider>
    );
  }

  return {
    user: userEvent.setup(),
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...rest }),
  };
}
