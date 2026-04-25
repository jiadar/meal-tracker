import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MonthPage } from "./MonthPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import {
  buildHandlers,
  createTestState,
  makeFood,
  seedDay,
} from "@/test/handlers";

const navigateMock = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("MonthPage", () => {
  it("shows empty state when the month has no days", async () => {
    const state = createTestState({ today: "2026-04-23" });
    server.use(...buildHandlers(state));
    renderWithProviders(<MonthPage />);

    expect(
      await screen.findByText(/no days logged for this month/i),
    ).toBeInTheDocument();
  });

  it("renders both stat-card rows with computed averages and the per-day table", async () => {
    const state = createTestState({
      today: "2026-04-23",
      foods: [
        makeFood({
          id: "f-rice",
          name: "Rice",
          calories: 130,
          carbs: 28,
          protein: 2.7,
          fat: 0.3,
          fiber: 0.4,
        }),
      ],
    });
    // Two days, each with 200g rice → calories per day = 260.
    seedDay(state, "2026-04-10", [{ foodId: "f-rice", grams: 200 }], { weight_lbs: "170.0" });
    seedDay(state, "2026-04-11", [{ foodId: "f-rice", grams: 200 }], { weight_lbs: "169.0" });
    server.use(...buildHandlers(state));

    renderWithProviders(<MonthPage />);

    // Avg calories = 260 (one meal each, 200g of 130-cal rice).
    const avgCalLabel = await screen.findByText("Avg Calories");
    const avgCalValue = avgCalLabel.nextSibling as HTMLElement;
    expect(avgCalValue).toHaveTextContent("260");

    // Both card-row labels render.
    expect(screen.getByText("Avg Fiber")).toBeInTheDocument();
    expect(screen.getByText("Avg Sodium")).toBeInTheDocument();
    expect(screen.getByText("Avg Creatine")).toBeInTheDocument();
    expect(screen.getByText("Avg Sleep")).toBeInTheDocument();
    expect(screen.getByText("Sleep Quality")).toBeInTheDocument();

    // Table shows day numbers and weights.
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("170.0")).toBeInTheDocument();
    expect(screen.getByText("169.0")).toBeInTheDocument();

    // AVG row rendered.
    expect(screen.getByText("AVG")).toBeInTheDocument();
  });

  it("clicking a per-day row navigates to /?date=YYYY-MM-DD", async () => {
    navigateMock.mockClear();
    const state = createTestState({
      today: "2026-04-23",
      foods: [makeFood({ id: "f-egg", name: "Egg", calories: 155, protein: 13, fat: 11 })],
    });
    seedDay(state, "2026-04-15", [{ foodId: "f-egg", grams: 50 }]);
    server.use(...buildHandlers(state));

    const { user } = renderWithProviders(<MonthPage />);

    // Wait for table row to render.
    const dayCell = await screen.findByText("15");
    await user.click(dayCell);

    expect(navigateMock).toHaveBeenCalledWith("/?date=2026-04-15");
  });

  it("color-codes calorie surplus/deficit on the AVG row", async () => {
    const state = createTestState({
      today: "2026-04-23",
      foods: [
        makeFood({ id: "f-light", name: "Light", calories: 50 }),
      ],
    });
    // 50g of 50-cal food → 25 cal/day, BMR 1970 → big deficit on AVG row.
    seedDay(state, "2026-04-10", [{ foodId: "f-light", grams: 50 }]);
    seedDay(state, "2026-04-11", [{ foodId: "f-light", grams: 50 }]);
    server.use(...buildHandlers(state));

    renderWithProviders(<MonthPage />);

    await screen.findByText("AVG");

    // Total Deficit card present + green.
    const deficitLabel = screen.getByText("Total Deficit");
    const deficitValue = deficitLabel.nextSibling as HTMLElement;
    await waitFor(() => {
      expect(deficitValue).toHaveStyle({ color: "var(--mantine-color-green-text)" });
    });
  });

  it("color-codes sodium against the user's target", async () => {
    const state = createTestState({
      today: "2026-04-23",
      foods: [
        makeFood({
          id: "f-salty",
          name: "Salty",
          calories: 100,
          sodium: 5000, // 5g of sodium per 100g — very salty
        }),
      ],
    });
    // 100g salty → 5000 mg sodium per day, way over the 2300 target.
    seedDay(state, "2026-04-10", [{ foodId: "f-salty", grams: 100 }]);
    server.use(...buildHandlers(state));

    renderWithProviders(<MonthPage />);

    await screen.findByText("Avg Sodium");
    // The sodium card should be red.
    const sodiumLabel = screen.getByText("Avg Sodium");
    const sodiumValue = sodiumLabel.nextSibling as HTMLElement;
    await waitFor(() => {
      expect(sodiumValue).toHaveStyle({ color: "var(--mantine-color-red-text)" });
    });
  });
});
