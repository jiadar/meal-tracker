import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DayDetailPage } from "./DayDetailPage";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/setup";
import {
  buildHandlers,
  createTestState,
  makeFood,
  seedDay,
  type TestState,
} from "@/test/handlers";

const OATS = makeFood({
  id: "food-oats",
  name: "Oats",
  calories: 389,
  fat: 6.9,
  protein: 17,
  carbs: 66,
});
const MILK = makeFood({
  id: "food-milk",
  name: "Milk",
  calories: 61,
  fat: 3.3,
  protein: 3.2,
  carbs: 4.8,
});

function setup(state: TestState) {
  server.use(...buildHandlers(state));
  return renderWithProviders(<DayDetailPage />);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DayDetailPage", () => {
  it("lets the user create a day when none exists, then add a meal", async () => {
    const state = createTestState({ foods: [OATS, MILK] });
    const { user } = setup(state);

    expect(await screen.findByText(/No day record for 2026-04-23/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create day/i }));

    expect(await screen.findByText(/No meals logged yet/i)).toBeInTheDocument();

    await user.click(screen.getByPlaceholderText(/search foods/i));
    await user.click(await screen.findByRole("option", { name: "Oats" }));

    const gramsInput = screen.getByLabelText("Grams", { exact: true });
    await user.tripleClick(gramsInput);
    await user.keyboard("50");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    const table = await screen.findByRole("table");
    await waitFor(() => {
      expect(within(table).getByText("Oats")).toBeInTheDocument();
    });

    expect(within(table).getByText(/TOTALS/)).toBeInTheDocument();
    // 50g of Oats at 389kcal/100g ≈ 195 kcal. The meal row and the totals row both show it.
    expect(within(table).getAllByText(/^19[45]$/)).toHaveLength(2);
    expect(within(table).getByText("50")).toBeInTheDocument();
  });

  it("shows the empty-state prompt before a day is created", async () => {
    setup(createTestState());
    expect(await screen.findByRole("button", { name: /create day/i })).toBeInTheDocument();
    expect(screen.queryByText(/TOTALS/)).not.toBeInTheDocument();
  });

  it("renders TOTALS across multiple seeded meals", async () => {
    const state = createTestState({ foods: [OATS, MILK] });
    seedDay(state, "2026-04-23", [
      { foodId: OATS.id, grams: 100 },
      { foodId: MILK.id, grams: 200 },
    ]);
    setup(state);

    const table = await screen.findByRole("table");
    await within(table).findByText("Oats");
    expect(within(table).getByText("Milk")).toBeInTheDocument();

    // 100g Oats (389) + 200g Milk (122) = 511 kcal
    expect(within(table).getByText("511")).toBeInTheDocument();
    // Summary card "Consumed" uses 1-decimal formatting via fmt(_, 0) → "511".
    expect(screen.getByText(/Consumed/i)).toBeInTheDocument();
  });

  it("edits a meal's grams and updates TOTALS", async () => {
    const state = createTestState({ foods: [OATS] });
    seedDay(state, "2026-04-23", [{ foodId: OATS.id, grams: 100 }]);
    const { user } = setup(state);

    const table = await screen.findByRole("table");
    const oatsRow = within(table).getByText("Oats").closest("tr")!;

    await user.click(within(oatsRow).getByRole("button", { name: /edit/i }));

    const gramsEdit = within(oatsRow).getByRole("textbox");
    await user.tripleClick(gramsEdit);
    await user.keyboard("200");
    await user.click(within(oatsRow).getByRole("button", { name: /save/i }));

    // 200g Oats ≈ 778 kcal (both meal cell and TOTALS cell).
    await waitFor(() => {
      expect(within(table).getAllByText("778")).toHaveLength(2);
    });
    // Old 389 total should be gone.
    expect(within(table).queryAllByText("389")).toHaveLength(0);
  });

  it("deletes a meal after confirm", async () => {
    const state = createTestState({ foods: [OATS, MILK] });
    seedDay(state, "2026-04-23", [
      { foodId: OATS.id, grams: 100 },
      { foodId: MILK.id, grams: 200 },
    ]);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const { user } = setup(state);

    const table = await screen.findByRole("table");
    await within(table).findByText("Oats");

    const oatsRow = within(table).getByText("Oats").closest("tr")!;
    await user.click(within(oatsRow).getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(within(table).queryByText("Oats")).not.toBeInTheDocument();
    });
    // Milk row and its totals remain; Oats totals gone.
    expect(within(table).getByText("Milk")).toBeInTheDocument();
  });

  it("cancels deletion when the user declines the confirm", async () => {
    const state = createTestState({ foods: [OATS] });
    seedDay(state, "2026-04-23", [{ foodId: OATS.id, grams: 100 }]);
    vi.spyOn(window, "confirm").mockReturnValue(false);

    const { user } = setup(state);

    const table = await screen.findByRole("table");
    const oatsRow = within(table).getByText("Oats").closest("tr")!;
    await user.click(within(oatsRow).getByRole("button", { name: /delete/i }));

    // Row is still there after a declined confirm.
    expect(within(table).getByText("Oats")).toBeInTheDocument();
  });

  it("cancel button in edit mode discards grams changes", async () => {
    const state = createTestState({ foods: [OATS] });
    seedDay(state, "2026-04-23", [{ foodId: OATS.id, grams: 100 }]);
    const { user } = setup(state);

    const table = await screen.findByRole("table");
    const oatsRow = within(table).getByText("Oats").closest("tr")!;

    await user.click(within(oatsRow).getByRole("button", { name: /edit/i }));
    const gramsEdit = within(oatsRow).getByRole("textbox");
    await user.tripleClick(gramsEdit);
    await user.keyboard("999");
    await user.click(within(oatsRow).getByRole("button", { name: /cancel/i }));

    // Back to non-edit display with the original value.
    expect(within(oatsRow).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(oatsRow).getByText("100")).toBeInTheDocument();
    expect(within(table).queryByText("999")).not.toBeInTheDocument();
  });
});
