import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DayDetailPage } from "./DayDetailPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import { buildHandlers, createTestState, seedDay } from "@/test/handlers";

afterEach(() => {
  vi.restoreAllMocks();
});

function napPanel(): HTMLElement {
  const titles = screen.getAllByText(/^nap$/i);
  const title = titles.find((el) => el.tagName === "H5");
  if (!title) throw new Error("Nap panel title not found");
  return title.closest("div") as HTMLElement;
}

describe("NapPanel", () => {
  it("renders empty with Save disabled and no Delete button when no nap exists", async () => {
    const state = createTestState();
    seedDay(state, "2026-04-23", []);
    server.use(...buildHandlers(state));
    renderWithProviders(<DayDetailPage />);

    await screen.findByText(/^nap$/i);
    const panel = napPanel();
    expect(within(panel).getByRole("button", { name: /^save$/i })).toBeDisabled();
    expect(
      within(panel).queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  it("creates a nap entry when fields are filled", async () => {
    const state = createTestState();
    seedDay(state, "2026-04-23", []);
    server.use(...buildHandlers(state));
    const { user } = renderWithProviders(<DayDetailPage />);

    await screen.findByText(/^nap$/i);
    const panel = napPanel();

    const hours = within(panel).getByLabelText(/hours/i);
    await user.tripleClick(hours);
    await user.keyboard("1");
    fireEvent.change(within(panel).getByLabelText(/start time/i), {
      target: { value: "15:00" },
    });

    const save = within(panel).getByRole("button", { name: /^save$/i });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    await waitFor(() => {
      expect(state.days[0].nap).not.toBeNull();
    });
    expect(state.days[0].nap).toMatchObject({
      hours: "1.00",
      start_time: "15:00",
    });
  });

  it("deletes a nap after confirm", async () => {
    const state = createTestState();
    const day = seedDay(state, "2026-04-23", []);
    day.nap = {
      id: "nap-seed",
      day: day.id,
      hours: "1.50",
      start_time: "15:00:00",
    };
    server.use(...buildHandlers(state));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const { user } = renderWithProviders(<DayDetailPage />);
    await screen.findByText(/^nap$/i);
    const panel = napPanel();
    await user.click(within(panel).getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(state.days[0].nap).toBeNull();
    });
  });
});
