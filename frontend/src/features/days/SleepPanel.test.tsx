import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DayDetailPage } from "./DayDetailPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import {
  buildHandlers,
  createTestState,
  seedDay,
  type SleepFixture,
} from "@/test/handlers";

afterEach(() => {
  vi.restoreAllMocks();
});

function sleepPanel(): HTMLElement {
  // The Sleep panel is the Paper containing the "Sleep" Title.
  const titles = screen.getAllByText(/^sleep$/i);
  const title = titles.find((el) => el.tagName === "H5");
  if (!title) throw new Error("Sleep panel title not found");
  return title.closest("[class*='Paper'], div") as HTMLElement;
}

describe("Sleep panel", () => {
  it("renders empty with Save disabled and no Delete button when no sleep exists", async () => {
    const state = createTestState();
    seedDay(state, "2026-04-23", []);
    server.use(...buildHandlers(state));
    renderWithProviders(<DayDetailPage />);

    await screen.findByLabelText(/hours/i);

    const panel = sleepPanel();
    expect(within(panel).getByRole("button", { name: /^save$/i })).toBeDisabled();
    expect(
      within(panel).queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  it("creates a sleep entry when all fields are filled and Save is clicked", async () => {
    const state = createTestState();
    seedDay(state, "2026-04-23", []);
    server.use(...buildHandlers(state));
    const { user } = renderWithProviders(<DayDetailPage />);

    await screen.findByLabelText(/hours/i);
    const panel = sleepPanel();

    const hoursInput = within(panel).getByLabelText(/hours/i);
    await user.tripleClick(hoursInput);
    await user.keyboard("8");

    // Mantine Rating fires onChange via clicks on the label (not the hidden radio).
    const radio4 = within(panel).getByRole("radio", { name: "4" }) as HTMLInputElement;
    const label4 = panel.querySelector(`label[for="${radio4.id}"]`) as HTMLElement;
    await user.click(label4);

    fireEvent.change(within(panel).getByLabelText(/bedtime/i), {
      target: { value: "23:00" },
    });
    fireEvent.change(within(panel).getByLabelText(/wake/i), {
      target: { value: "06:30" },
    });
    await user.click(within(panel).getByLabelText(/meds/i));

    const save = within(panel).getByRole("button", { name: /^save$/i });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    // After save, the day refetches and panel now shows the persisted sleep.
    await waitFor(() => {
      expect(state.days[0].sleep).not.toBeNull();
    });
    expect(state.days[0].sleep).toMatchObject({
      hours: "8.00",
      quality: 4,
      bedtime: "23:00",
      wake: "06:30",
      meds: true,
    });

    // Delete button is now visible.
    await waitFor(() => {
      expect(
        within(sleepPanel()).getByRole("button", { name: /delete/i }),
      ).toBeInTheDocument();
    });
  });

  it("edits an existing sleep entry via PATCH", async () => {
    const state = createTestState();
    const day = seedDay(state, "2026-04-23", []);
    const seeded: SleepFixture = {
      id: "sleep-seed",
      day: day.id,
      hours: "7.50",
      quality: 4,
      bedtime: "23:00:00",
      wake: "06:30:00",
      meds: false,
    };
    day.sleep = seeded;
    server.use(...buildHandlers(state));
    const { user } = renderWithProviders(<DayDetailPage />);

    await screen.findByLabelText(/hours/i);
    const panel = sleepPanel();

    // Save starts disabled because state matches seed.
    const save = within(panel).getByRole("button", { name: /^save$/i });
    expect(save).toBeDisabled();

    // Bump hours to 8.0.
    const hoursInput = within(panel).getByLabelText(/hours/i);
    await user.tripleClick(hoursInput);
    await user.keyboard("8");

    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    await waitFor(() => {
      expect(state.days[0].sleep?.hours).toBe("8.00");
    });
  });

  it("deletes the sleep entry after confirm", async () => {
    const state = createTestState();
    const day = seedDay(state, "2026-04-23", []);
    day.sleep = {
      id: "sleep-seed",
      day: day.id,
      hours: "7.50",
      quality: 4,
      bedtime: "23:00:00",
      wake: "06:30:00",
      meds: false,
    };
    server.use(...buildHandlers(state));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const { user } = renderWithProviders(<DayDetailPage />);

    const panel = await waitFor(() => sleepPanel());
    const deleteBtn = within(panel).getByRole("button", { name: /delete/i });
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(state.days[0].sleep).toBeNull();
    });
    await waitFor(() => {
      expect(
        within(sleepPanel()).queryByRole("button", { name: /delete/i }),
      ).not.toBeInTheDocument();
    });
  });
});
