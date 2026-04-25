import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WeightPage } from "./WeightPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import { buildHandlers, createTestState, seedDay } from "@/test/handlers";

vi.mock("./WeightChart", () => ({
  WeightChart: () => <div data-testid="weight-chart" />,
}));

describe("WeightPage", () => {
  it("shows empty state when no day in the month has weight", async () => {
    const state = createTestState({ today: "2026-04-23" });
    seedDay(state, "2026-04-10", []);
    server.use(...buildHandlers(state));

    renderWithProviders(<WeightPage />);

    expect(
      await screen.findByText(/no weight logged for this month/i),
    ).toBeInTheDocument();
  });

  it("renders Start / Current / Change / Low stat cards from MonthSummary", async () => {
    const state = createTestState({ today: "2026-04-23" });
    seedDay(state, "2026-04-10", [], { weight_lbs: "170.0" });
    seedDay(state, "2026-04-15", [], { weight_lbs: "168.0" });
    seedDay(state, "2026-04-20", [], { weight_lbs: "169.5" });
    server.use(...buildHandlers(state));

    renderWithProviders(<WeightPage />);

    await screen.findByText("Start");
    expect(screen.getByText("170.0")).toBeInTheDocument(); // start
    // Current = last by date = 169.5
    // Low = 168.0
    expect(screen.getByText("168.0")).toBeInTheDocument();
    expect(screen.getByText("169.5")).toBeInTheDocument();

    // Change: start - end = 0.5 (lost) → display as -0.5 (signed delta).
    const changeLabel = screen.getByText("Change");
    const changeValue = changeLabel.nextSibling as HTMLElement;
    expect(changeValue).toHaveTextContent("-0.5");
    // Lost weight → green.
    await waitFor(() => {
      expect(changeValue).toHaveStyle({ color: "var(--mantine-color-green-text)" });
    });
  });

  it("color-codes Change red when the user gained weight", async () => {
    const state = createTestState({ today: "2026-04-23" });
    seedDay(state, "2026-04-05", [], { weight_lbs: "167.4" });
    seedDay(state, "2026-04-23", [], { weight_lbs: "171.6" });
    server.use(...buildHandlers(state));

    renderWithProviders(<WeightPage />);

    await screen.findByText("Change");
    const changeLabel = screen.getByText("Change");
    const changeValue = changeLabel.nextSibling as HTMLElement;
    expect(changeValue).toHaveTextContent("+4.2");
    await waitFor(() => {
      expect(changeValue).toHaveStyle({ color: "var(--mantine-color-red-text)" });
    });
  });
});
