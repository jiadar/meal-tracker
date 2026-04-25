import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DayDetailPage } from "./DayDetailPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import { buildHandlers, createTestState, seedDay } from "@/test/handlers";

describe("SleepBar", () => {
  it("renders nothing when the day has no sleep", async () => {
    const state = createTestState();
    seedDay(state, "2026-04-23", []);
    server.use(...buildHandlers(state));
    renderWithProviders(<DayDetailPage />);

    // Wait for page hydrate.
    await screen.findByText(/day detail/i);
    // No SLEEP label in the bar (the editor SleepPanel uses "Sleep" but the
    // bar uses uppercase "SLEEP"). The SleepPanel still renders, so just
    // verify the bedtime → wake formatting from the bar is absent.
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it("renders the bar with hours, dots, range, MEDS, NAP, and location", async () => {
    const state = createTestState();
    const day = seedDay(state, "2026-04-23", [], { location: "NOLA" });
    day.sleep = {
      id: "sleep-1",
      day: day.id,
      hours: "7.50",
      quality: 4,
      bedtime: "22:10:00",
      wake: "05:55:00",
      meds: true,
    };
    day.nap = {
      id: "nap-1",
      day: day.id,
      hours: "1.00",
      start_time: "15:00:00",
    };
    server.use(...buildHandlers(state));
    renderWithProviders(<DayDetailPage />);

    expect(await screen.findByText("7.5h")).toBeInTheDocument();
    expect(screen.getByText("22:10 → 05:55")).toBeInTheDocument();
    expect(screen.getByText("MEDS")).toBeInTheDocument();
    expect(screen.getByText(/NAP\s+1\.0h/)).toBeInTheDocument();
    expect(screen.getByText("NOLA")).toBeInTheDocument();
  });
});
