import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RegisterPage } from "./RegisterPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import { buildHandlers, createTestState } from "@/test/handlers";

describe("RegisterPage", () => {
  it("renders the registration form when registration is enabled", async () => {
    const state = createTestState();
    server.use(...buildHandlers(state));
    renderWithProviders(<RegisterPage />);

    expect(await screen.findByRole("button", { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
  });

  it("shows disabled message and hides form when registration is disabled", async () => {
    const state = createTestState();
    state.allowRegistration = false;
    server.use(...buildHandlers(state));
    renderWithProviders(<RegisterPage />);

    expect(await screen.findByText("Registration is currently disabled.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create account/i })).not.toBeInTheDocument();
  });
});
