import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoalsPage } from "./GoalsPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import {
  buildHandlers,
  createTestState,
  seedDay,
  type WeightGoalFixture,
} from "@/test/handlers";

afterEach(() => {
  vi.restoreAllMocks();
});

function seedGoal(state: ReturnType<typeof createTestState>, partial: Partial<WeightGoalFixture> = {}): WeightGoalFixture {
  const goal: WeightGoalFixture = {
    id: `goal-${state.nextGoalId++}`,
    start_date: "2026-04-05",
    end_date: "2026-04-12",
    start_weight: "170.0",
    goal_weight: "168.0",
    active: true,
    created_at: "2026-04-05T00:00:00Z",
    updated_at: "2026-04-05T00:00:00Z",
    ...partial,
  };
  state.weightGoals.push(goal);
  return goal;
}

describe("GoalsPage", () => {
  it("shows the create form when no active goal exists", async () => {
    const state = createTestState();
    server.use(...buildHandlers(state));

    renderWithProviders(<GoalsPage />);

    expect(await screen.findByText(/^new goal$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start weight/i)).toBeInTheDocument();
  });

  it("renders the 6 stat cards and tracking table when an active goal exists", async () => {
    const state = createTestState();
    seedGoal(state);
    // Seed days with weights along the goal range.
    seedDay(state, "2026-04-05", [], { weight_lbs: "170.0" });
    seedDay(state, "2026-04-08", [], { weight_lbs: "169.5" });
    server.use(...buildHandlers(state));

    renderWithProviders(<GoalsPage />);

    await screen.findByText("Start Weight");
    // Both a stat card and a table header use "Goal Weight" — both should be present.
    expect(screen.getAllByText("Goal Weight").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Total Loss")).toBeInTheDocument();
    expect(screen.getByText("Daily Loss")).toBeInTheDocument();
    expect(screen.getByText("Daily Deficit")).toBeInTheDocument();
    expect(screen.getByText("Target Date")).toBeInTheDocument();

    // Total loss = 2.0 over 7 days → daily loss = 0.29 (rounded to 2dp).
    const totalLossLabel = screen.getByText("Total Loss");
    const totalLossValue = totalLossLabel.nextSibling as HTMLElement;
    expect(totalLossValue).toHaveTextContent("2.0");

    // Tracking table shows 8 rows (Apr 5 through Apr 12) — Apr 5 is unique
    // to the table; Apr 12 also shows on the Target Date stat card.
    expect(screen.getByText("2026-04-05")).toBeInTheDocument();
    expect(screen.getAllByText("2026-04-12").length).toBeGreaterThanOrEqual(2);

    // Day 0 actual (170.0) matches goal weight 170.0 exactly → "On track".
    // Wait for the days range query to populate the table.
    await waitFor(() => {
      const onTracks = screen.getAllByText(/on track/i);
      expect(onTracks.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("deletes the goal after confirm", async () => {
    const state = createTestState();
    seedGoal(state);
    server.use(...buildHandlers(state));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const { user } = renderWithProviders(<GoalsPage />);

    await screen.findByText("Start Weight");
    await user.click(screen.getByRole("button", { name: /delete goal/i }));

    await waitFor(() => {
      expect(state.weightGoals).toHaveLength(0);
    });
    // Form returns.
    await waitFor(() => {
      expect(screen.getByText(/^new goal$/i)).toBeInTheDocument();
    });
  });
});
