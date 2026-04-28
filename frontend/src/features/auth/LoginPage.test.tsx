import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoginPage } from "./LoginPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import { buildHandlers, createTestState } from "@/test/handlers";

describe("LoginPage", () => {
  it("shows create account link when registration is enabled", async () => {
    const state = createTestState();
    server.use(...buildHandlers(state));
    renderWithProviders(<LoginPage />);

    expect(await screen.findByText("Create an account")).toBeInTheDocument();
  });

  it("hides create account link when registration is disabled", async () => {
    const state = createTestState();
    state.allowRegistration = false;
    server.use(...buildHandlers(state));
    renderWithProviders(<LoginPage />);

    await screen.findByLabelText(/email/i);
    expect(screen.queryByText("Create an account")).not.toBeInTheDocument();
  });
});
