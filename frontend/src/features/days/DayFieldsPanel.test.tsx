import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DayDetailPage } from "./DayDetailPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import { buildHandlers, createTestState, seedDay } from "@/test/handlers";

describe("Day details panel", () => {
  it("renders current weight, location, creatine from the day record", async () => {
    const state = createTestState();
    seedDay(state, "2026-04-23", [], {
      weight_lbs: "167.4",
      location: "NOLA",
      creatine_mg: 5,
    });
    server.use(...buildHandlers(state));
    renderWithProviders(<DayDetailPage />);

    const weight = await screen.findByLabelText(/weight \(lbs\)/i);
    expect(weight).toHaveValue("167.4");
    expect(screen.getByLabelText(/location/i)).toHaveValue("NOLA");
    expect(screen.getByLabelText(/creatine/i)).toHaveValue("5");

    // Summary card mirrors the weight value.
    const cards = screen.getAllByText(/weight/i);
    expect(cards.length).toBeGreaterThan(0);
  });

  it("patches weight/location/creatine and reflects them after save", async () => {
    const state = createTestState();
    seedDay(state, "2026-04-23", [], {
      weight_lbs: "167.4",
      location: "SD",
      creatine_mg: null,
    });
    server.use(...buildHandlers(state));
    const { user } = renderWithProviders(<DayDetailPage />);

    const weight = await screen.findByLabelText(/weight \(lbs\)/i);
    await user.tripleClick(weight);
    await user.keyboard("170");

    const loc = screen.getByLabelText(/location/i);
    await user.clear(loc);
    await user.type(loc, "NOLA");

    const creatine = screen.getByLabelText(/creatine/i);
    await user.tripleClick(creatine);
    await user.keyboard("5");

    // Save button in the day-details panel.
    const panel = screen.getByText(/day details/i).closest("div")!;
    await user.click(within(panel).getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(state.days[0].weight_lbs).toBe("170.0");
    });
    expect(state.days[0].location).toBe("NOLA");
    expect(state.days[0].creatine_mg).toBe(5);
  });

  it("Save button is disabled until something changes", async () => {
    const state = createTestState();
    seedDay(state, "2026-04-23", [], {
      weight_lbs: "167.4",
      location: "SD",
      creatine_mg: null,
    });
    server.use(...buildHandlers(state));
    renderWithProviders(<DayDetailPage />);

    await screen.findByLabelText(/weight \(lbs\)/i);
    const panel = screen.getByText(/day details/i).closest("div")!;
    expect(within(panel).getByRole("button", { name: /save/i })).toBeDisabled();
  });
});
