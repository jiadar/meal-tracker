import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SleepPage } from "./SleepPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import {
  buildHandlers,
  createTestState,
  seedDay,
  type SleepFixture,
  type DayFixture,
} from "@/test/handlers";

// Recharts + jsdom doesn't measure container dimensions, so the real chart
// pollutes test output with warnings and renders nothing useful. The chart's
// behaviour isn't part of these tests — verify it manually.
vi.mock("./SleepChart", () => ({
  SleepChart: () => <div data-testid="sleep-chart" />,
}));

function attachSleep(
  day: DayFixture,
  partial: Partial<Omit<SleepFixture, "id" | "day">> & {
    hours: string;
    quality: number;
    bedtime: string;
    wake: string;
  },
): SleepFixture {
  const sleep: SleepFixture = {
    id: `sleep-${day.id}`,
    day: day.id,
    meds: false,
    ...partial,
  };
  day.sleep = sleep;
  return sleep;
}

describe("SleepPage", () => {
  it("shows empty state when the month has no sleep entries", async () => {
    const state = createTestState({ today: "2026-04-23" });
    seedDay(state, "2026-04-10", []); // day exists but no sleep
    server.use(...buildHandlers(state));

    renderWithProviders(<SleepPage />);

    expect(
      await screen.findByText(/no sleep logged for this month/i),
    ).toBeInTheDocument();
  });

  it("renders stat cards from the month summary and a table row per sleep day", async () => {
    const state = createTestState({ today: "2026-04-23" });
    const d1 = seedDay(state, "2026-04-14", []);
    attachSleep(d1, {
      hours: "7.50",
      quality: 4,
      bedtime: "22:10",
      wake: "05:55",
    });
    const d2 = seedDay(state, "2026-04-15", []);
    attachSleep(d2, {
      hours: "8.50",
      quality: 5,
      bedtime: "21:30",
      wake: "06:00",
      meds: true,
    });
    server.use(...buildHandlers(state));

    renderWithProviders(<SleepPage />);

    // Stat cards
    expect(await screen.findByText("Avg Hours")).toBeInTheDocument();
    expect(screen.getByText("8.00")).toBeInTheDocument();
    expect(screen.getByText("Avg Quality")).toBeInTheDocument();
    expect(screen.getByText("4.50")).toBeInTheDocument();
    expect(screen.getByText("Days Tracked")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();

    // Table rows
    expect(screen.getByText("22:10")).toBeInTheDocument();
    expect(screen.getByText("05:55")).toBeInTheDocument();
    expect(screen.getByText("21:30")).toBeInTheDocument();
    expect(screen.getByText("06:00")).toBeInTheDocument();

    // Meds: only one row should show "Yes"
    const yesCells = screen.getAllByText("Yes");
    expect(yesCells).toHaveLength(1);
  });

  it("color-codes hours per spec: red for < 7, yellow for [7, target), green for >= target", async () => {
    const state = createTestState({ today: "2026-04-23" });
    const dRed = seedDay(state, "2026-04-10", []);
    attachSleep(dRed, {
      hours: "6.00",
      quality: 4,
      bedtime: "23:00",
      wake: "05:00",
    });
    const dYellow = seedDay(state, "2026-04-11", []);
    attachSleep(dYellow, {
      hours: "7.50",
      quality: 4,
      bedtime: "22:30",
      wake: "06:00",
    });
    const dGreen = seedDay(state, "2026-04-12", []);
    attachSleep(dGreen, {
      hours: "8.50",
      quality: 4,
      bedtime: "22:00",
      wake: "06:30",
    });
    server.use(...buildHandlers(state));

    renderWithProviders(<SleepPage />);

    // Mantine renders <Text c="red"> with style="color: var(--mantine-color-red-text)".
    // Hours cells are <span> elements; pick them by their numeric text.
    await screen.findAllByText("6.0");
    const reds = screen
      .getAllByText("6.0")
      .filter((el) => el.tagName === "SPAN");
    const yellows = screen
      .getAllByText("7.5")
      .filter((el) => el.tagName === "SPAN");
    const greens = screen
      .getAllByText("8.5")
      .filter((el) => el.tagName === "SPAN");
    expect(reds[0]).toHaveStyle({ color: "var(--mantine-color-red-text)" });
    expect(yellows[0]).toHaveStyle({
      color: "var(--mantine-color-yellow-text)",
    });
    expect(greens[0]).toHaveStyle({ color: "var(--mantine-color-green-text)" });
  });

  it("navigates between months and refetches data", async () => {
    const state = createTestState({ today: "2026-04-23" });
    const aprDay = seedDay(state, "2026-04-15", []);
    attachSleep(aprDay, {
      hours: "8.00",
      quality: 4,
      bedtime: "22:00",
      wake: "06:00",
    });
    const marDay = seedDay(state, "2026-03-10", []);
    attachSleep(marDay, {
      hours: "5.00",
      quality: 2,
      bedtime: "01:00",
      wake: "06:00",
    });
    server.use(...buildHandlers(state));

    const { user } = renderWithProviders(<SleepPage />);

    // Defaults to April 2026 — bedtime 22:00 is unique to the April row.
    await screen.findByText("22:00");
    expect(screen.getByText(/APR 2026/i)).toBeInTheDocument();
    expect(screen.queryByText("01:00")).not.toBeInTheDocument();

    // Step back a month → March 2026 → bedtime 01:00.
    await user.click(screen.getByRole("button", { name: /previous month/i }));
    await waitFor(() => {
      expect(screen.getByText(/MAR 2026/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("01:00")).toBeInTheDocument();
    });
    expect(screen.queryByText("22:00")).not.toBeInTheDocument();

    // Step forward → back to April 2026 (next chevron is enabled while we're in March).
    await user.click(screen.getByRole("button", { name: /next month/i }));
    await waitFor(() => {
      expect(screen.getByText(/APR 2026/i)).toBeInTheDocument();
    });
  });

  it("disables the next-month chevron at the current month", async () => {
    const state = createTestState({ today: "2026-04-23" });
    server.use(...buildHandlers(state));

    renderWithProviders(<SleepPage />);

    await screen.findByText(/APR 2026/i);
    const next = screen.getByRole("button", { name: /next month/i });
    expect(next).toBeDisabled();
  });

  it("renders nap hours when present", async () => {
    const state = createTestState({ today: "2026-04-23" });
    const day = seedDay(state, "2026-04-15", []);
    attachSleep(day, {
      hours: "7.00",
      quality: 4,
      bedtime: "23:00",
      wake: "06:00",
    });
    day.nap = {
      id: "nap-1",
      day: day.id,
      hours: "1.50",
      start_time: "15:00",
    };
    server.use(...buildHandlers(state));

    renderWithProviders(<SleepPage />);

    // Hours = 7.0, Nap = 1.5, Total = 8.5
    expect(await screen.findByText("7.0")).toBeInTheDocument();
    expect(screen.getByText("1.5")).toBeInTheDocument();
    expect(screen.getByText("8.5")).toBeInTheDocument();
  });

});
