import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DayDetailPage } from "./DayDetailPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import { buildHandlers, createTestState, seedDay } from "@/test/handlers";

function getCard(label: RegExp | string): HTMLElement {
  // Stat cards put the label in a <p data-size="xs"> with the value as its sibling.
  // Pick that specific one to avoid colliding with the panel titles that share a word.
  const matches = screen.getAllByText(label).filter(
    (el) => el.tagName === "P" && el.getAttribute("data-size") === "xs",
  );
  if (matches.length !== 1) {
    throw new Error(`expected 1 stat-card label for ${label}, got ${matches.length}`);
  }
  return matches[0].parentElement as HTMLElement;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Exercise panel", () => {
  it("shows the empty-state when no exercises", async () => {
    const state = createTestState();
    seedDay(state, "2026-04-23", []);
    server.use(...buildHandlers(state));
    renderWithProviders(<DayDetailPage />);

    expect(await screen.findByText(/no exercise logged yet/i)).toBeInTheDocument();
  });

  it("adds an exercise and updates the Exercise + Allowed stat cards", async () => {
    const state = createTestState();
    seedDay(state, "2026-04-23", []);
    server.use(...buildHandlers(state));
    const { user } = renderWithProviders(<DayDetailPage />);

    await screen.findByLabelText(/activity/i);

    await user.type(screen.getByLabelText(/activity/i), "Jiu Jitsu");
    const minutes = screen.getByLabelText(/minutes/i);
    await user.tripleClick(minutes);
    await user.keyboard("60");
    const cal = screen.getByLabelText(/calories/i);
    await user.tripleClick(cal);
    await user.keyboard("600");

    await user.click(screen.getByRole("button", { name: /add exercise/i }));

    // Row appears in the exercise table.
    await waitFor(() => {
      expect(screen.getByText("Jiu Jitsu")).toBeInTheDocument();
    });

    // Exercise summary card reflects 600.
    await waitFor(() => {
      expect(within(getCard(/^exercise$/i)).getByText("600")).toBeInTheDocument();
    });
    // Allowed = BMR 1970 + 600 = 2,570.
    expect(within(getCard(/^allowed$/i)).getByText("2,570")).toBeInTheDocument();
  });

  it("deletes an exercise after confirm and rolls back Allowed", async () => {
    const state = createTestState();
    const day = seedDay(state, "2026-04-23", []);
    day.exercises.push({
      id: "ex-seed",
      day: day.id,
      activity: "BJJ",
      duration_minutes: 60,
      calories: 500,
      position: 0,
    });
    server.use(...buildHandlers(state));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const { user } = renderWithProviders(<DayDetailPage />);

    const bjjRow = (await screen.findByText("BJJ")).closest("tr")!;
    await user.click(within(bjjRow).getByRole("button", { name: /delete exercise/i }));

    await waitFor(() => {
      expect(screen.queryByText("BJJ")).not.toBeInTheDocument();
    });
    // Allowed drops back to BMR alone.
    expect(within(getCard(/^allowed$/i)).getByText("1,970")).toBeInTheDocument();
  });

  it("Add exercise is disabled without an activity and calories", async () => {
    const state = createTestState();
    seedDay(state, "2026-04-23", []);
    server.use(...buildHandlers(state));
    renderWithProviders(<DayDetailPage />);

    await screen.findByLabelText(/activity/i);
    expect(screen.getByRole("button", { name: /add exercise/i })).toBeDisabled();
  });
});
